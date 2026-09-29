/** Küçük Büfe: a small kiosk — drinks fridge, snack shelf, magazine rack and a till. Second step. */
import { Box3, Vector3 } from "three"
import { WALL_T } from "@/models/shop-kit/shop-floor"
import { createModularShelf } from "@/models/shop-kit/modular-shelf"
import { createCheckoutCounter } from "@/models/shop-kit/checkout-counter"
import { createDrinksFridge } from "@/models/shop-kit/drinks-fridge"
import type { ShopKit } from "@/kits/shop-kit/context"
import { mulberry32, type Economy } from "@/game/economy"
import { SalesFloor, type ShelfSlot } from "@/game/sales-floor"
import { buildInterior, socketWorld } from "./interior"
import { navFor, type Interactable, type Level, type LevelId } from "./level"

export function createKioskLevel(kit: ShopKit, eco: Economy, go: (to: LevelId) => void): Level & { floor: SalesFloor } {
  const room = buildInterior({ kit, floor: { width: 7, depth: 6 }, pendants: [[0.2, -0.6], [2.2, 0.4]], clockX: -0.6, go })
  const { place, hw, hd } = room

  const fridge = place(createDrinksFridge(kit, { width: 0.9, brand: "red" }), -1.6, room.backZ(0.7))
  const snacks = place(createModularShelf(kit, { bays: 2, bayWidth: 0.75, depth: 0.45, height: 1.5, levels: 4, stock: 0.9 }), -hw + WALL_T + 0.245, 0.1, Math.PI / 2)
  const rack = place(createModularShelf(kit, { bays: 1, bayWidth: 1, depth: 0.4, height: 1.2, levels: 3, backPanel: true, stock: 0.8 }), 0.75, room.backZ(0.4))
  const counter = place(createCheckoutCounter(kit, { width: 1.6, registerSide: "right" }), 2.25, 0.25)

  const area = { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd }
  const nav = navFor(area, [fridge, snacks, rack, counter].map((m) => m.root), 0.24, 0.2, [
    [-hw, -hd, hw, -hd + WALL_T], [-hw, -hd, -hw + WALL_T, hd],
  ])

  const slots: ShelfSlot[] = [
    { id: "fridge-1", label: "İçecek dolabı", model: fridge, spot: socketWorld(fridge, "front"), price: 16 },
    { id: "snacks", label: "Atıştırmalık rafı", model: snacks, spot: socketWorld(snacks, "front"), price: 12 },
    { id: "rack", label: "Gazete standı", model: rack, spot: socketWorld(rack, "front"), price: 9 },
  ]
  const till = socketWorld(counter, "cashier")
  const floor = new SalesFloor(eco, {
    scene: room.scene, nav, entrance: room.entrance,
    queueHead: socketWorld(counter, "customer"), queueStep: new Vector3(-0.7, 0, 0.25), queueFacing: new Vector3(0, 0, -1),
    rng: mulberry32(2024),
  }, slots, { where: "kiosk", baseCustomers: 4, spawnBase: 8.5, patience: 35, restockFull: 26, till })

  let playerPos = new Vector3()
  const unit = (s: ShelfSlot): Interactable => ({
    id: s.id, label: `${s.label} · doldur`, pick: s.model.root,
    spot: () => s.spot, face: () => s.model.root.position,
    interact: () => floor.restock(s, playerPos),
  })
  const interactables: Interactable[] = [
    ...slots.map(unit),
    {
      id: "counter", label: "Kasa · ödeme al", pick: counter.root,
      spot: () => till, face: () => counter.root.position,
      interact: () => { counter.actions.ring(); floor.serve(playerPos) },
    },
    room.exit,
  ]

  // Second fridge from the "İkinci dolap" upgrade.
  let extra = false
  const sync = () => {
    if (extra || eco.tier !== "kiosk" || eco.stats.extraUnits < 1) return
    extra = true
    const f2 = place(createDrinksFridge(kit, { width: 0.9, brand: "blue" }), -0.55, room.backZ(0.7))
    const box = new Box3().setFromObject(f2.root)
    nav.blockRect(box.min.x, box.min.z, box.max.x, box.max.z, 0.24)
    const slot: ShelfSlot = { id: "fridge-2", label: "İkinci dolap", model: f2, spot: socketWorld(f2, "front"), price: 18 }
    floor.addShelf(slot)
    interactables.splice(interactables.length - 1, 0, unit(slot))
  }
  eco.upgrades.onChange(sync)
  sync()

  return {
    id: "kiosk",
    title: "Küçük Büfe",
    scene: room.scene,
    nav,
    bounds: { minX: -5, maxX: 5, minZ: -4.5, maxZ: 4.5 },
    zoom: { initial: 4.6, min: 2.5, max: 8 },
    interactables,
    labels: [],
    floor,
    arrival: () => room.arrival(),
    update(dt, ctx) {
      playerPos = ctx.playerPos
      floor.update(dt)
      for (const m of room.models) m.update(dt)
    },
    setDayProgress(t) {
      room.atmosphere.setDayProgress(t)
      room.setClock(eco.hours())
    },
    moods: () => floor.moods(),
    work: () => null,
    dispose() { floor.dispose(); room.dispose() },
  }
}
