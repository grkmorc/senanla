/**
 * @shop-kit/street-block — one city block: paved lots, sidewalks with kerbs, a two-lane
 * E-W road with dashed centre line and zebra crossings, a grass verge, and optionally a
 * N-S cross road forming a signalised intersection.
 * Pivot: block centre; walking level is y = 0, roads sit 120 mm lower.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, type Builder, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface StreetBlockConfig {
  width: number
  depth: number
  roadZ: number
  roadWidth: number
  sidewalk: number
  crossingX: number
  cross: boolean
  crossX: number
}

const BASE = -0.3
export const ROAD_Y = -0.12
const KERB = 0.16

export const streetBlockDefinition: ModelDefinition<StreetBlockConfig> = {
  id: "street-block",
  title: "Street Block",
  description: "Paved lots, sidewalks with kerbs, an E-W road with markings, grass verge and an optional N-S cross road.",
  categories: ["architecture", "exterior", "ground"],
  defaults: { width: 44, depth: 32, roadZ: 6, roadWidth: 6, sidewalk: 2.5, crossingX: 0, cross: false, crossX: 20 },
  fields: {
    width: { type: "number", min: 10, max: 200, step: 1, unit: "m", doc: "Block length along the E-W road." },
    depth: { type: "number", min: 10, max: 160, step: 1, unit: "m", doc: "Block depth." },
    roadZ: { type: "number", min: -60, max: 60, step: 0.5, unit: "m", doc: "E-W road centre line Z." },
    roadWidth: { type: "number", min: 4, max: 14, step: 0.5, unit: "m", doc: "Kerb to kerb width (both roads)." },
    sidewalk: { type: "number", min: 1, max: 6, step: 0.5, unit: "m", doc: "Sidewalk width." },
    crossingX: { type: "number", min: -90, max: 90, step: 0.5, unit: "m", doc: "Mid-block zebra crossing X on the E-W road." },
    cross: { type: "boolean", doc: "Add a N-S cross road and intersection." },
    crossX: { type: "number", min: -90, max: 90, step: 0.5, unit: "m", doc: "N-S road centre line X." },
  },
  materialSlots: ["lot", "sidewalk", "road", "grass", "curb", "paint"],
  parts: ["ground", "road", "markings", "curbs"],
  sockets: [],
  actions: [],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: 0.3 }),
  capabilities: ["webgl"],
}

/** Zebra crossing: `across` is the axis the pedestrians walk along. */
function zebra(b: Builder, label: string, across: "x" | "z", centre: number, from: number, to: number, stripes = 6) {
  const cw = stripes > 4 ? 0.45 : 0.4
  const gap = stripes > 4 ? 0.35 : 0.3
  const total = stripes * cw + (stripes - 1) * gap
  for (let i = 0; i < stripes; i++) {
    const s = centre - total / 2 + i * (cw + gap)
    if (across === "z") b.span("markings", "paint", `${label}-${i}`, [s, ROAD_Y, from], [s + cw, ROAD_Y + 0.004, to])
    else b.span("markings", "paint", `${label}-${i}`, [from, ROAD_Y, s], [to, ROAD_Y + 0.004, s + cw])
  }
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
    const rw = c.roadWidth
    const sw = c.sidewalk
    const r0 = c.roadZ - rw / 2
    const r1 = c.roadZ + rw / 2
    const s0 = r0 - sw
    const s1 = r1 + sw

    // X bands: plain block | cross sidewalk | cross road | cross sidewalk | plain block.
    const q0 = c.crossX - rw / 2
    const q1 = c.crossX + rw / 2
    type Band = { x0: number; x1: number; kind: "plain" | "walk" | "road" }
    const bands: Band[] = c.cross
      ? [
          { x0: -hw, x1: q0 - sw, kind: "plain" },
          { x0: q0 - sw, x1: q0, kind: "walk" },
          { x0: q0, x1: q1, kind: "road" },
          { x0: q1, x1: q1 + sw, kind: "walk" },
          { x0: q1 + sw, x1: hw, kind: "plain" },
        ]
      : [{ x0: -hw, x1: hw, kind: "plain" }]

    bands.forEach((band, i) => {
      const { x0, x1 } = band
      if (x1 - x0 < 0.01) return
      if (band.kind === "road") {
        b.span("road", "road", `road-ns`, [x0, BASE, -hd], [x1, ROAD_Y, hd])
        return
      }
      if (band.kind === "walk") {
        b.span("ground", "sidewalk", `walk-n-${i}`, [x0, BASE, -hd], [x1, 0, r0])
        b.span("road", "road", `road-ew-${i}`, [x0, BASE, r0], [x1, ROAD_Y, r1])
        b.span("ground", "sidewalk", `walk-s-${i}`, [x0, BASE, r1], [x1, 0, hd])
        return
      }
      b.span("ground", "lot", `lot-${i}`, [x0, BASE, -hd], [x1, 0, s0])
      b.span("ground", "sidewalk", `sidewalk-near-${i}`, [x0, BASE, s0], [x1, 0, r0])
      b.span("road", "road", `road-ew-${i}`, [x0, BASE, r0], [x1, ROAD_Y, r1])
      b.span("ground", "sidewalk", `sidewalk-far-${i}`, [x0, BASE, r1], [x1, 0, s1])
      if (s1 < hd) b.span("ground", "grass", `verge-${i}`, [x0, BASE, s1], [x1, -0.02, hd])
    })

    // Kerbs: E-W kerbs stop at the cross road; N-S kerbs stop short of the E-W kerb line.
    const ewRuns: [number, number][] = c.cross ? [[-hw, q0], [q1, hw]] : [[-hw, hw]]
    ewRuns.forEach(([a, z], i) => {
      const xa = a + 0.001
      const xz = z - 0.001
      b.span("curbs", "curb", `curb-n-${i}`, [xa, ROAD_Y, r0 - KERB], [xz, 0.02, r0 + 0.001], { bevel: 0.01 })
      b.span("curbs", "curb", `curb-s-${i}`, [xa, ROAD_Y, r1 - 0.001], [xz, 0.02, r1 + KERB], { bevel: 0.01 })
    })
    if (c.cross) {
      const runs: [number, number][] = [[-hd + 0.001, r0 - KERB - 0.001], [r1 + KERB + 0.001, hd - 0.001]]
      runs.forEach(([za, zz], i) => {
        b.span("curbs", "curb", `curb-w-${i}`, [q0 - KERB, ROAD_Y, za], [q0 + 0.001, 0.02, zz], { bevel: 0.01 })
        b.span("curbs", "curb", `curb-e-${i}`, [q1 - 0.001, ROAD_Y, za], [q1 + KERB, 0.02, zz], { bevel: 0.01 })
      })
    }

    // Paving joints on the shop-side sidewalk.
    for (let x = -hw + 1.25, i = 0; x < hw - 0.5; x += 1.25, i++) {
      if (Math.abs(x - c.crossingX) < 2.4) continue
      if (c.cross && x > q0 - sw - 0.2 && x < q1 + sw + 0.2) continue
      b.span("markings", "curb", `joint-${i}`, [x - 0.015, 0, s0 + 0.05], [x + 0.015, 0.004, r0 - KERB - 0.04])
    }

    // E-W centre dashes, skipping crossings and the intersection.
    const skipX = (x: number) =>
      Math.abs(x - c.crossingX) < 2.6 || (c.cross && x > q0 - sw - 3 && x < q1 + sw + 1.5)
    for (let x = -hw + 1, i = 0; x < hw - 2; x += 3, i++) {
      if (skipX(x) || skipX(x + 1.5)) continue
      b.span("markings", "paint", `dash-${i}`, [x, ROAD_Y, c.roadZ - 0.07], [x + 1.5, ROAD_Y + 0.004, c.roadZ + 0.07])
    }
    zebra(b, "zebra-mid", "z", c.crossingX, r0 + 0.35, r1 - 0.35)
    // Edge lines.
    ewRuns.forEach(([a, z], i) => {
      b.span("markings", "paint", `edge-n-${i}`, [a + 0.002, ROAD_Y, r0 + 0.25], [z - 0.002, ROAD_Y + 0.003, r0 + 0.35])
      b.span("markings", "paint", `edge-s-${i}`, [a + 0.002, ROAD_Y, r1 - 0.35], [z - 0.002, ROAD_Y + 0.003, r1 - 0.25])
    })

    if (c.cross) {
      // N-S centre dashes, skipping the intersection box.
      for (let z = -hd + 1, i = 0; z < hd - 2; z += 3, i++) {
        if (z + 1.5 > s0 - 3 && z < s1 + 1.5) continue
        b.span("markings", "paint", `dash-ns-${i}`, [c.crossX - 0.07, ROAD_Y, z], [c.crossX + 0.07, ROAD_Y + 0.004, z + 1.5])
      }
      // Zebras on all four arms, in line with the sidewalks they connect.
      zebra(b, "zebra-w", "z", q0 - sw / 2, r0 + 0.35, r1 - 0.35, 3)
      zebra(b, "zebra-e", "z", q1 + sw / 2, r0 + 0.35, r1 - 0.35, 3)
      zebra(b, "zebra-n", "x", r0 - sw / 2, q0 + 0.35, q1 - 0.35, 3)
      zebra(b, "zebra-s", "x", r1 + sw / 2, q0 + 0.35, q1 - 0.35, 3)
      // Stop lines just before each zebra, across the approaching lane (right-hand traffic).
      b.span("markings", "paint", "stop-w", [q0 - sw - 0.8, ROAD_Y, c.roadZ + 0.1], [q0 - sw - 0.5, ROAD_Y + 0.004, r1 - 0.36])
      b.span("markings", "paint", "stop-e", [q1 + sw + 0.5, ROAD_Y, r0 + 0.36], [q1 + sw + 0.8, ROAD_Y + 0.004, c.roadZ - 0.1])
      b.span("markings", "paint", "stop-n", [q0 + 0.2, ROAD_Y, s0 - 0.8], [c.crossX - 0.1, ROAD_Y + 0.004, s0 - 0.5])
      b.span("markings", "paint", "stop-s", [c.crossX + 0.1, ROAD_Y, s1 + 0.5], [q1 - 0.2, ROAD_Y + 0.004, s1 + 0.8])
    }
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
