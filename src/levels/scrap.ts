/** Hurdalık: fenced dirt yard with salvage piles and a dealer's desk that sells parts. */
import { PointLight, Vector3, MeshStandardMaterial } from "three"
import { WALL_T } from "@/models/shop-kit/shop-floor"
import { createCheckoutCounter } from "@/models/shop-kit/checkout-counter"
import { createScrapPile } from "@/models/shop-kit/scrap-pile"
import { createStreetLamp } from "@/models/shop-kit/street-lamp"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { Economy } from "@/game/economy"
import { ScrapYard, PILE_MAX, type PileSlot } from "@/game/scrap-yard"
import { buildInterior, socketWorld } from "./interior"
import { navFor, type Interactable, type Level, type LevelId } from "./level"

export function createScrapLevel(kit: ShopKit, eco: Economy, go: (to: LevelId) => void): Level & { yard: ScrapYard } {
  const width = 14
  const depth = 11
  // Instance material overrides turn the tiled shop floor into a dirt yard with a metal fence.
  const dirt = new MeshStandardMaterial({ color: "#5c4a38", roughness: 1 })
  const gravel = new MeshStandardMaterial({ color: "#7b7163", roughness: 1 })
  const fence = new MeshStandardMaterial({ color: "#7f8a8c", roughness: 0.5, metalness: 0.6 })
  const rust = new MeshStandardMaterial({ color: "#8a4b2a", roughness: 0.85, metalness: 0.3 })
  const room = buildInterior({
    kit, go, pendants: [],
    floor: { width, depth, wainscot: false, wallHeight: 2, tileSize: 2 },
    floorMaterials: { tile: dirt, tileAlt: dirt, tileLight: gravel, wall: fence, trim: rust },
  })
  const { place, hw, hd } = room

  const pileSpots: [number, number, number][] = [[-4.2, -2.6, 1.3], [-0.6, -3.1, 1.1], [3.2, -2.4, 1.2], [-4.6, 1.4, 1.0], [-1.2, 0.6, 0.9]]
  const piles: PileSlot[] = pileSpots.map(([x, z, r], i) => {
    const model = place(createScrapPile(kit, { radius: r, variant: i * 7 + 2 }), x, z)
    return { id: `pile-${i + 1}`, model, spot: socketWorld(model, "work"), left: PILE_MAX }
  })
  const dealer = place(createCheckoutCounter(kit, { width: 1.8, registerSide: "right" }, { body: rust, panel: fence }), 4.2, 2.4)

  const lamps = [place(createStreetLamp(kit, { height: 3 }), 5.8, -3.6), place(createStreetLamp(kit, { height: 3 }), -5.9, 3.8)]
  const lampLights = lamps.map((l) => {
    const p = new PointLight("#ffd29a", 2, 8, 1.3)
    p.userData.excludeFromExport = true
    p.position.copy(l.sockets.light.anchor.position)
    l.parts.lantern.anchor.add(p)
    return p
  })
  room.atmosphere.onProgress = (t) => {
    const k = Math.max(0, (t - 0.55) / 0.45)
    lampLights.forEach((p) => { p.intensity = k * 6 })
    lamps.forEach((l) => l.actions.setOn(t > 0.55))
  }

  const area = { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd }
  const nav = navFor(area, [...piles.map((p) => p.model), dealer, ...lamps].map((m) => m.root), 0.24, 0.2, [
    [-hw, -hd, hw, -hd + WALL_T], [-hw, -hd, -hw + WALL_T, hd],
  ])

  const yard = new ScrapYard(eco, piles)
  let playerPos = new Vector3()
  const interactables: Interactable[] = [
    ...piles.map((p) => ({
      id: p.id, label: "Hurda yığını · sök", pick: p.model.root,
      spot: () => p.spot, face: () => p.model.root.position,
      interact: () => yard.strip(p),
    })),
    {
      id: "dealer", get label() { return `Parça tezgâhı · ₺${yard.partPrice}` }, pick: dealer.root,
      spot: () => socketWorld(dealer, "customer"), face: () => dealer.root.position,
      interact: () => { dealer.actions.ring(); yard.buyPart(playerPos) },
    },
    room.exit,
  ]

  return {
    id: "scrap",
    title: "Hurdalık",
    scene: room.scene,
    nav,
    bounds: { minX: -8, maxX: 8, minZ: -7, maxZ: 7 },
    zoom: { initial: 7, min: 3, max: 11 },
    interactables,
    labels: [],
    yard,
    arrival: () => room.arrival(),
    update(dt, ctx) {
      playerPos = ctx.playerPos
      yard.update(dt, ctx.playerMoving)
      for (const m of room.models) m.update(dt)
    },
    setDayProgress(t) { room.atmosphere.setDayProgress(t) },
    moods: () => [],
    work: () => {
      const p = yard.workProgress
      return p !== null ? { text: "Söküm", progress: p } : null
    },
    dispose() {
      room.dispose()
      ;[dirt, gravel, fence, rust].forEach((m) => m.dispose())
    },
  }
}
