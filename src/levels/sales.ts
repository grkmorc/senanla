/** Mağaza: the sales shop — shelves, till and walk-in buyers. */
import { Vector3 } from "three"
import { WALL_T } from "@/models/shop-kit/shop-floor"
import { createModularShelf } from "@/models/shop-kit/modular-shelf"
import { createCheckoutCounter } from "@/models/shop-kit/checkout-counter"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { Economy } from "@/game/economy"
import { mulberry32 } from "@/game/economy"
import { SalesFloor, type ShelfSlot } from "@/game/sales-floor"
import { buildInterior, socketWorld } from "./interior"
import { navFor, type Interactable, type Level, type LevelId } from "./level"

export function createSalesLevel(kit: ShopKit, eco: Economy, go: (to: LevelId) => void): Level & { floor: SalesFloor } {
  const width = 12
  const depth = 10
  const room = buildInterior({ kit, floor: { width, depth }, pendants: [[2.6, 2.1], [-1.75, -2.95], [-3.9, 1.6]], clockX: 1.25, go })
  const { place, hw, hd } = room

  const shelves = [
    place(createModularShelf(kit, { bays: 2, stock: 0.9 }), -3.1, room.backZ(0.5)),
    place(createModularShelf(kit, { bays: 2, levels: 5, stock: 0.7 }), -0.4, room.backZ(0.5)),
    place(createModularShelf(kit, { bays: 2, height: 1.4, levels: 3, backPanel: false, depth: 0.6, stock: 0.8 }), -1.75, -1.4),
    place(createModularShelf(kit, { bays: 3, stock: 0.6 }), -hw + WALL_T + 0.27, 0.9, Math.PI / 2),
    place(createModularShelf(kit, { bays: 2, levels: 5, stock: 0.85 }), 3.4, room.backZ(0.5)),
  ]
  const counter = place(createCheckoutCounter(kit, { registerSide: "right" }), 2.6, 2.1)

  const area = { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd }
  const nav = navFor(area, [...shelves, counter].map((m) => m.root), 0.24, 0.2, [
    [-hw, -hd, hw, -hd + WALL_T], [-hw, -hd, -hw + WALL_T, hd],
  ])

  const slots: ShelfSlot[] = shelves.map((m, i) => ({
    id: `shelf-${i + 1}`, label: `Raf ${i + 1}`, model: m, spot: socketWorld(m, "front"), price: [8, 12, 6, 10, 14][i],
  }))
  const sales = new SalesFloor(eco, {
    scene: room.scene, nav, entrance: room.entrance,
    queueHead: socketWorld(counter, "customer"), queueStep: new Vector3(-0.72, 0, 0.3), queueFacing: new Vector3(0, 0, -1),
    rng: mulberry32(1001),
  }, slots)

  let playerPos = new Vector3()
  const interactables: Interactable[] = [
    ...slots.map((s) => ({
      id: s.id, label: `${s.label} · doldur`, pick: s.model.root,
      spot: () => s.spot, face: () => s.model.root.position,
      interact: () => sales.restock(s, playerPos),
    })),
    {
      id: "counter", label: "Kasa · ödeme al", pick: counter.root,
      spot: () => socketWorld(counter, "cashier"), face: () => counter.root.position,
      interact: () => { counter.actions.ring(); sales.serve(playerPos) },
    },
    room.exit,
  ]

  return {
    id: "sales",
    title: "Mağaza",
    scene: room.scene,
    nav,
    bounds: { minX: -8, maxX: 8, minZ: -7, maxZ: 7 },
    zoom: { initial: 6.5, min: 2.5, max: 10 },
    interactables,
    labels: [],
    floor: sales,
    arrival: () => room.arrival(),
    update(dt, ctx) {
      playerPos = ctx.playerPos
      sales.update(dt)
      for (const m of room.models) m.update(dt)
    },
    setDayProgress(t) {
      room.atmosphere.setDayProgress(t)
      room.setClock(eco.hours())
    },
    moods: () => sales.moods(),
    work: () => null,
    dispose() { sales.dispose(); room.dispose() },
  }
}
