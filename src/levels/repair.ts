/** Tamirhane: reception desk, two benches, a parts rack that shows your spare-part stock. */
import { PointLight, Vector3 } from "three"
import { WALL_T } from "@/models/shop-kit/shop-floor"
import { createModularShelf } from "@/models/shop-kit/modular-shelf"
import { createCheckoutCounter } from "@/models/shop-kit/checkout-counter"
import { createRepairBench } from "@/models/shop-kit/repair-bench"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { Economy } from "@/game/economy"
import { mulberry32 } from "@/game/economy"
import { RepairDesk } from "@/game/repair-desk"
import { buildInterior, socketWorld } from "./interior"
import { navFor, type Interactable, type Level, type LevelId } from "./level"

export function createRepairLevel(kit: ShopKit, eco: Economy, go: (to: LevelId) => void): Level & { desk: RepairDesk } {
  const width = 10
  const depth = 8
  const room = buildInterior({ kit, floor: { width, depth }, pendants: [[1.8, 1.3], [-1.5, -1.9]], clockX: -3.6, go })
  const { place, hw, hd } = room

  const benchZ = room.backZ(0.75)
  const benches = [
    place(createRepairBench(kit, { vise: "right" }), -1.6, benchZ),
    place(createRepairBench(kit, { vise: "left" }), 1.3, benchZ),
  ]
  // Parts rack along the left wall; its stock mirrors how many spare parts you hold.
  const rack = place(createModularShelf(kit, { bays: 2, levels: 4, depth: 0.45, stock: 0.2 }), -hw + WALL_T + 0.245, -0.6, Math.PI / 2)
  const desk = place(createCheckoutCounter(kit, { width: 2, registerSide: "left" }), 2.2, 1.3)

  const lamps = benches.map((b) => {
    const l = new PointLight("#ffb45a", 3, 3.5, 1.6)
    l.userData.vibe3dRole = "lamp.light"
    l.userData.excludeFromExport = true
    l.position.set(b === benches[0] ? -0.4 : 0.4, 1.15, -0.075)
    b.parts.lamp.anchor.add(l)
    b.actions.setLamp(false)
    return l
  })
  void lamps
  let activeBench = 0
  const setLamp = (on: boolean) => benches.forEach((b, i) => b.actions.setLamp(on && i === activeBench))

  const area = { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd }
  const nav = navFor(area, [...benches, rack, desk].map((m) => m.root), 0.24, 0.2, [
    [-hw, -hd, hw, -hd + WALL_T], [-hw, -hd, -hw + WALL_T, hd],
  ])

  const seats = [new Vector3(-3.4, 0, 2.7), new Vector3(-2.6, 0, 3.1), new Vector3(-3.4, 0, 1.7), new Vector3(-2.6, 0, 2.1)]
  const repair = new RepairDesk(eco, {
    scene: room.scene, nav, entrance: room.entrance,
    queueHead: socketWorld(desk, "customer"), queueStep: new Vector3(0.7, 0, 0.3), queueFacing: new Vector3(0, 0, -1),
    rng: mulberry32(2002),
  }, seats, setLamp)

  let playerPos = new Vector3()
  const interactables: Interactable[] = [
    ...benches.map((b, i) => ({
      id: `bench-${i + 1}`, label: "Tamir masası · onar", pick: b.root,
      spot: () => socketWorld(b, "work"), face: () => b.root.position,
      interact: () => {
        activeBench = i
        if (!repair.useBench()) {
          if (eco.carry === "fixed") eco.notify.say("Cihaz hazır · resepsiyonda teslim et")
          else if (eco.carry === null) eco.notify.say("Önce resepsiyondan bir cihaz al")
        }
      },
    })),
    {
      id: "desk", label: "Resepsiyon · cihaz al, teslim et", pick: desk.root,
      spot: () => socketWorld(desk, "cashier"), face: () => desk.root.position,
      interact: () => repair.serve(playerPos),
    },
    {
      id: "rack", label: "Parça rafı", pick: rack.root,
      spot: () => socketWorld(rack, "front"), face: () => rack.root.position,
      interact: () => eco.notify.say(`Rafta ${eco.parts} yedek parça var`),
    },
    room.exit,
  ]

  let shownParts = -1
  return {
    id: "repair",
    title: "Tamirhane",
    scene: room.scene,
    nav,
    bounds: { minX: -7, maxX: 7, minZ: -6, maxZ: 6 },
    zoom: { initial: 5.5, min: 2.5, max: 9 },
    interactables,
    labels: [],
    desk: repair,
    arrival: () => room.arrival(),
    update(dt, ctx) {
      playerPos = ctx.playerPos
      repair.update(dt, ctx.playerMoving)
      if (eco.parts !== shownParts) {
        shownParts = eco.parts
        rack.configure({ stock: Math.min(1, eco.parts / 8) })
      }
      for (const m of room.models) m.update(dt)
    },
    setDayProgress(t) {
      room.atmosphere.setDayProgress(t)
      room.setClock(eco.hours())
    },
    moods: () => repair.moods(),
    work: () => {
      const p = repair.repairProgress
      return p !== null ? { text: "Tamir", progress: p } : null
    },
    dispose() { repair.dispose(); room.dispose() },
  }
}
