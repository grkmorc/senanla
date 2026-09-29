/**
 * @shop-kit/street-block — one city block: paved lot for buildings, sidewalks with curbs,
 * a two-lane road with dashed centre line and a zebra crossing, and a grass verge.
 * Pivot: block centre; the lot/sidewalk walking level is y = 0, the road sits 120 mm lower.
 * The road runs along X at z = roadZ.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface StreetBlockConfig {
  width: number
  depth: number
  roadZ: number
  roadWidth: number
  sidewalk: number
  crossingX: number
}

const BASE = -0.3
export const ROAD_Y = -0.12

export const streetBlockDefinition: ModelDefinition<StreetBlockConfig> = {
  id: "street-block",
  title: "Street Block",
  description: "Paved shop lot, sidewalks with curbs, two-lane road with markings and a grass verge.",
  categories: ["architecture", "exterior", "ground"],
  defaults: { width: 44, depth: 32, roadZ: 6, roadWidth: 6, sidewalk: 2.5, crossingX: 0 },
  fields: {
    width: { type: "number", min: 10, max: 120, step: 1, unit: "m", doc: "Block length along the road." },
    depth: { type: "number", min: 10, max: 80, step: 1, unit: "m", doc: "Block depth across the road." },
    roadZ: { type: "number", min: -30, max: 30, step: 0.5, unit: "m", doc: "Road centre line Z." },
    roadWidth: { type: "number", min: 4, max: 14, step: 0.5, unit: "m", doc: "Kerb to kerb width." },
    sidewalk: { type: "number", min: 1, max: 6, step: 0.5, unit: "m", doc: "Sidewalk width on each side." },
    crossingX: { type: "number", min: -50, max: 50, step: 0.5, unit: "m", doc: "Zebra crossing centre X." },
  },
  materialSlots: ["lot", "sidewalk", "road", "grass", "curb", "paint"],
  parts: ["ground", "road", "markings", "curbs"],
  sockets: [],
  actions: [],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: 0.3 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<StreetBlockConfig, Record<string, never>> = {
  definition: streetBlockDefinition,
  slotMap: {
    lot: "surface.paving",
    sidewalk: "surface.sidewalk",
    road: "surface.asphalt",
    grass: "surface.grass",
    curb: "surface.curb",
    paint: "signal.paint",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    const r0 = c.roadZ - c.roadWidth / 2
    const r1 = c.roadZ + c.roadWidth / 2
    const s0 = r0 - c.sidewalk
    const s1 = r1 + c.sidewalk

    b.span("ground", "lot", "lot", [-hw, BASE, -hd], [hw, 0, s0])
    b.span("ground", "sidewalk", "sidewalk-near", [-hw, BASE, s0], [hw, 0, r0])
    b.span("road", "road", "road", [-hw, BASE, r0], [hw, ROAD_Y, r1])
    b.span("ground", "sidewalk", "sidewalk-far", [-hw, BASE, r1], [hw, 0, s1])
    if (s1 < hd) b.span("ground", "grass", "verge", [-hw, BASE, s1], [hw, -0.02, hd])

    // Kerb stones stand 20 mm proud of the sidewalk and overhang the road edge by 1 mm.
    b.span("curbs", "curb", "curb-near", [-hw + 0.001, ROAD_Y, r0 - 0.16], [hw - 0.001, 0.02, r0 + 0.001], { bevel: 0.01 })
    b.span("curbs", "curb", "curb-far", [-hw + 0.001, ROAD_Y, r1 - 0.001], [hw - 0.001, 0.02, r1 + 0.16], { bevel: 0.01 })
    // Paving joints on the near sidewalk every 1.25 m.
    for (let x = -hw + 1.25, i = 0; x < hw - 0.5; x += 1.25, i++) {
      if (Math.abs(x - c.crossingX) < 2.4) continue
      b.span("markings", "curb", `joint-${i}`, [x - 0.015, 0, s0 + 0.05], [x + 0.015, 0.004, r0 - 0.2])
    }

    // Dashed centre line, skipping the crossing.
    const y = ROAD_Y
    for (let x = -hw + 1, i = 0; x < hw - 2; x += 3, i++) {
      if (Math.abs(x + 0.75 - c.crossingX) < 2.6) continue
      b.span("markings", "paint", `dash-${i}`, [x, y, c.roadZ - 0.07], [x + 1.5, y + 0.004, c.roadZ + 0.07])
    }
    // Zebra crossing.
    const stripes = 6
    const cw = 0.45
    const cgap = 0.35
    const total = stripes * cw + (stripes - 1) * cgap
    for (let i = 0; i < stripes; i++) {
      const x = c.crossingX - total / 2 + i * (cw + cgap)
      b.span("markings", "paint", `zebra-${i}`, [x, y, r0 + 0.35], [x + cw, y + 0.004, r1 - 0.35])
    }
    // Edge lines.
    b.span("markings", "paint", "edge-near", [-hw + 0.002, y, r0 + 0.25], [hw - 0.002, y + 0.003, r0 + 0.35])
    b.span("markings", "paint", "edge-far", [-hw + 0.002, y, r1 - 0.35], [hw - 0.002, y + 0.003, r1 - 0.25])
  },
  sockets: () => ({}),
}

export type StreetBlock = ModelInstance<StreetBlockConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createStreetBlock(kit: ShopKit, config: Partial<StreetBlockConfig> = {}, materials: Partial<Record<string, Material>> = {}): StreetBlock {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<StreetBlockConfig> = {}) {
  return createStreetBlock(kit, config)
}
