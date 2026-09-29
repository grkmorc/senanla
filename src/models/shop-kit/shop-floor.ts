/**
 * @shop-kit/shop-floor — tiled shop floor slab with optional back/left walls.
 * Pivot: floor centre, top surface at y = 0. Front of the shop faces +Z.
 */
import type { Group } from "three"
import type { Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface ShopFloorConfig {
  width: number
  depth: number
  tileSize: number
  walls: boolean
  wallHeight: number
}

export const SLAB = 0.12
export const WALL_T = 0.2
const TILE_H = 0.012
const GROUT = 0.012

export const shopFloorDefinition: ModelDefinition<ShopFloorConfig> = {
  id: "shop-floor",
  title: "Shop Floor",
  description: "Tiled floor slab; optional back and left walls for an open-front isometric shop.",
  categories: ["architecture", "floor"],
  defaults: { width: 12, depth: 10, tileSize: 1, walls: true, wallHeight: 2.6 },
  fields: {
    width: { type: "number", min: 4, max: 40, step: 0.5, unit: "m", doc: "Slab width along X." },
    depth: { type: "number", min: 4, max: 40, step: 0.5, unit: "m", doc: "Slab depth along Z." },
    tileSize: { type: "number", min: 0.25, max: 2, step: 0.25, unit: "m", doc: "Square tile edge." },
    walls: { type: "boolean", doc: "Build back (-Z) and left (-X) walls." },
    wallHeight: { type: "number", min: 1, max: 5, step: 0.1, unit: "m", doc: "Wall height above floor." },
  },
  materialSlots: ["slab", "tile", "tileAlt", "wall", "trim"],
  parts: ["slab", "tiles", "walls"],
  sockets: ["entrance"],
  actions: [],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: c.walls ? c.wallHeight : TILE_H }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<ShopFloorConfig, Record<string, never>> = {
  definition: shopFloorDefinition,
  slotMap: {
    slab: "surface.floorTrim",
    tile: "surface.floor",
    tileAlt: "surface.woodDark",
    wall: "surface.counterTop",
    trim: "surface.woodDark",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    // Slab: top face at y = 0, visible only in grout lines.
    b.span("slab", "slab", "base", [-hw, -SLAB, -hd], [hw, 0, hd])

    // Tiles sit on the slab (bottom faces oppose the slab top: no coplanar pair).
    const x0 = c.walls ? -hw + WALL_T : -hw
    const z0 = c.walls ? -hd + WALL_T : -hd
    const nx = Math.floor((hw - x0) / c.tileSize + 1e-6)
    const nz = Math.floor((hd - z0) / c.tileSize + 1e-6)
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const ax = x0 + ix * c.tileSize + GROUT / 2
        const az = z0 + iz * c.tileSize + GROUT / 2
        const alt = (ix + iz) % 2 === 1 && b.random() > 0.15
        b.span("tiles", alt ? "tileAlt" : "tile", `tile-${ix}-${iz}`,
          [ax, 0, az], [ax + c.tileSize - GROUT, TILE_H, az + c.tileSize - GROUT], { bevel: 0.004 })
      }
    }

    if (c.walls) {
      // Walls stand on the slab top inside its footprint; the corner is owned by the back wall
      // so the two walls never share a visible face.
      b.span("walls", "wall", "back", [-hw, 0, -hd], [hw, c.wallHeight, -hd + WALL_T])
      b.span("walls", "wall", "left", [-hw, 0, -hd + WALL_T], [-hw + WALL_T, c.wallHeight, hd])
      // Skirting boards proud of the wall faces by 15 mm.
      const s = 0.12
      b.span("walls", "trim", "skirting-back", [-hw + WALL_T, TILE_H, -hd + WALL_T], [hw, s, -hd + WALL_T + 0.015])
      b.span("walls", "trim", "skirting-left", [-hw + WALL_T, TILE_H, -hd + WALL_T + 0.015], [-hw + WALL_T + 0.015, s, hd])
      // Cap rail on top of the walls.
      b.span("walls", "trim", "cap-back", [-hw - 0.02, c.wallHeight, -hd - 0.02], [hw + 0.02, c.wallHeight + 0.05, -hd + WALL_T + 0.02])
      b.span("walls", "trim", "cap-left", [-hw - 0.019, c.wallHeight + 0.001, -hd + WALL_T + 0.02], [-hw + WALL_T + 0.02, c.wallHeight + 0.049, hd + 0.02])
    }
  },
  sockets: (c) => ({ entrance: { kind: "nav.spawn", at: [0, 0, c.depth / 2 - 0.6] } }),
}

export type ShopFloor = ModelInstance<ShopFloorConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createShopFloor(kit: ShopKit, config: Partial<ShopFloorConfig> = {}, materials: Partial<Record<string, Material>> = {}): ShopFloor {
  return instantiateShopModel(kit, spec, config, materials)
}

/** vibe-model entrypoint. */
export function createModel(kit: ShopKit = createShopKit(), config: Partial<ShopFloorConfig> = {}) {
  return createShopFloor(kit, config)
}
