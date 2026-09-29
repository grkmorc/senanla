/** Mağaza: the sales shop — shelves, till and walk-in buyers. */
import { Box3, Vector3 } from "three"
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

  // Shelves bought as upgrades: built up front, but only placed in the shop once unlocked.
  const extraSpots: { x: number; z: number; rot: number; cfg: Parameters<typeof createModularShelf>[1] }[] = [
    { x: -hw + WALL_T + 0.27, z: -2.6, rot: Math.PI / 2, cfg: { bays: 2, levels: 5, stock: 1 } },
    { x: 0.9, z: -1.4, rot: 0, cfg: { bays: 2, height: 1.4, levels: 3, backPanel: false, depth: 0.6, stock: 1 } },
  ]

  const area = { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd }
  const nav = navFor(area, [...shelves, counter].map((m) => m.root), 0.24, 0.2, [
    [-hw, -hd, hw, -hd + WALL_T], [-hw, -hd, -hw + WALL_T, hd],
  ])

  const slots: ShelfSlot[] = shelves.map((m, i) => ({
    id: `shelf-${i + 1}`, label: `Raf ${i + 1}`, model: m, spot: socketWorld(m, "front"), price: [8, 12, 6, 10, 14][i],
  }))
  const extraPrices = [11, 9]
  const sales = new SalesFloor(eco, {
    scene: room.scene, nav, entrance: room.entrance,
    queueHead: socketWorld(counter, "customer"), queueStep: new Vector3(-0.72, 0, 0.3), queueFacing: new Vector3(0, 0, -1),
    rng: mulberry32(1001),
  }, slots)

  let playerPos = new Vector3()
  const shelfInteractable = (s: ShelfSlot): Interactable => ({
    id: s.id, label: `${s.label} · doldur`, pick: s.model.root,
    spot: () => s.spot, face: () => s.model.root.position,
    interact: () => sales.restock(s, playerPos),
  })
  const interactables: Interactable[] = [
    ...slots.map(shelfInteractable),
    {
      id: "counter", label: "Kasa · ödeme al", pick: counter.root,
      spot: () => socketWorld(counter, "cashier"), face: () => counter.root.position,
      interact: () => { counter.actions.ring(); sales.serve(playerPos) },
    },
    room.exit,
  ]

  // Build any shelves the upgrades now call for (never removes: upgrades only go up).
  let built = 0
  const syncShelves = () => {
    while (built < Math.min(eco.stats.salesExtraShelves, extraSpots.length)) {
      const spot = extraSpots[built]
      const m = place(createModularShelf(kit, spot.cfg), spot.x, spot.z, spot.rot)
      const box = new Box3().setFromObject(m.root)
      nav.blockRect(box.min.x, box.min.z, box.max.x, box.max.z, 0.24)
      const n = shelves.length + built + 1
      const slot: ShelfSlot = { id: `shelf-${n}`, label: `Raf ${n}`, model: m, spot: socketWorld(m, "front"), price: extraPrices[built] }
      sales.addShelf(slot)
      interactables.splice(interactables.length - 1, 0, shelfInteractable(slot))
      built++
    }
  }
  eco.upgrades.onChange(syncShelves)
  syncShelves()

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
