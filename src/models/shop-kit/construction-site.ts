/**
 * @shop-kit/construction-site — a building going up behind plywood hoarding: concrete
 * slab, a column-and-slab skeleton `floors` storeys high with rebar sticking out, a tower
 * crane whose jib slews (`update`), a sand heap, a pallet of bricks and a cement mixer.
 * Pivot: ground centre of the lot. The street / gate faces +Z.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface ConstructionSiteConfig {
  width: number
  depth: number
  /** Storeys of skeleton already standing (0 = just the slab). */
  floors: number
  crane: boolean
}

const HOARD_H = 1.7
const STOREY = 3
const MAST_H = 11

export const constructionSiteDefinition: ModelDefinition<ConstructionSiteConfig> = {
  id: "construction-site",
  title: "Construction Site",
  description: "Hoarded building site with a concrete skeleton, tower crane and site clutter.",
  categories: ["exterior", "architecture"],
  defaults: { width: 8, depth: 8, floors: 2, crane: true },
  fields: {
    width: { type: "number", min: 5, max: 16, step: 0.5, unit: "m", doc: "Lot frontage." },
    depth: { type: "number", min: 5, max: 16, step: 0.5, unit: "m", doc: "Lot depth." },
    floors: { type: "integer", min: 0, max: 4, step: 1, unit: "count", doc: "Skeleton storeys already built." },
    crane: { type: "boolean", doc: "Tower crane at the back corner." },
  },
  materialSlots: ["ply", "band", "post", "concrete", "rebar", "crane", "weight", "cab", "sand", "brick", "mixer"],
  parts: ["hoarding", "structure", "crane", "clutter"],
  sockets: ["gate", "sign"],
  actions: [],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: c.crane ? MAST_H + 1.2 : Math.max(HOARD_H, c.floors * STOREY + 0.6) }),
  capabilities: ["webgl"],
}

const craneAt = (c: ConstructionSiteConfig): [number, number] => [-c.width / 2 + 1.4, -c.depth / 2 + 1.4]

const spec: ShopModelSpec<ConstructionSiteConfig, Record<string, never>> = {
  definition: constructionSiteDefinition,
  slotMap: {
    ply: "surface.plywood", band: "prop.goodsB", post: "hardware.steelDark", concrete: "surface.curb", rebar: "surface.rust",
    crane: "prop.goodsB", weight: "surface.stoneDark", cab: "surface.awningLight", sand: "surface.paving", brick: "surface.brick", mixer: "prop.goodsA",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    const t = 0.04
    const gate = 1.4

    // Hoarding: plywood sheets with a painted band, a gate gap in the front.
    b.span("hoarding", "ply", "ply-n", [-hw, 0, -hd], [hw, HOARD_H, -hd + t])
    b.span("hoarding", "ply", "ply-w", [-hw, 0, -hd + t], [-hw + t, HOARD_H, hd - t])
    b.span("hoarding", "ply", "ply-e", [hw - t, 0, -hd + t], [hw, HOARD_H, hd - t])
    b.span("hoarding", "ply", "ply-sw", [-hw, 0, hd - t], [-gate, HOARD_H, hd])
    b.span("hoarding", "ply", "ply-se", [gate, 0, hd - t], [hw, HOARD_H, hd])
    b.span("hoarding", "band", "band-sw", [-hw - 0.005, HOARD_H - 0.35, hd], [-gate, HOARD_H - 0.2, hd + 0.008])
    b.span("hoarding", "band", "band-se", [gate, HOARD_H - 0.35, hd], [hw + 0.005, HOARD_H - 0.2, hd + 0.008])
    b.span("hoarding", "band", "band-e", [hw, HOARD_H - 0.35, -hd], [hw + 0.008, HOARD_H - 0.2, hd])
    for (const x of [-gate, gate]) b.span("hoarding", "post", `gate-post-${x > 0 ? "e" : "w"}`, [x - 0.06, -0.01, hd - 0.1], [x + 0.06, HOARD_H + 0.2, hd + 0.03])
    // Board for the consumer's "İNŞAAT" plate.
    const sx0 = gate + 0.3
    b.span("hoarding", "cab", "sign-board", [sx0, 0.55, hd], [Math.min(hw - 0.2, sx0 + 2.2), 1.25, hd + 0.02])

    // Slab and skeleton.
    const inset = 0.6
    b.span("structure", "concrete", "slab", [-hw + inset, 0, -hd + inset], [hw - inset, 0.15, hd - inset])
    const x0 = -hw + inset + 0.2
    const x1 = hw - inset - 0.2
    const z0 = -hd + inset + 0.2
    const z1 = hd - inset - 0.2
    const cols: [number, number][] = []
    const nx = Math.max(1, Math.round((x1 - x0) / 3))
    const nz = Math.max(1, Math.round((z1 - z0) / 3))
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) cols.push([x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * j) / nz])
    const [cx, cz] = craneAt(c)
    const clear = (x: number, z: number) => !c.crane || Math.hypot(x - cx, z - cz) > 0.9
    for (let f = 0; f < c.floors; f++) {
      const y0 = 0.15 + f * STOREY
      cols.forEach(([x, z], k) => {
        if (clear(x, z)) b.span("structure", "concrete", `col-${f}-${k}`, [x - 0.15, y0, z - 0.15], [x + 0.15, y0 + STOREY - 0.25, z + 0.15])
      })
      b.span("structure", "concrete", `deck-${f}`, [x0 - 0.3, y0 + STOREY - 0.25, z0 - 0.3], [x1 + 0.3, y0 + STOREY, z1 + 0.3])
    }
    // Rebar starters on top of the highest level.
    const topY = 0.15 + c.floors * STOREY
    cols.forEach(([x, z], k) => {
      if (!clear(x, z)) return
      for (const [dx, dz] of [[-0.08, -0.08], [0.08, 0.08]]) {
        b.cylinder("structure", "rebar", `rebar-${k}-${dx > 0 ? 1 : 0}`, 0.012, 0.6, [x + dx, topY + 0.3, z + dz], { segments: 6 })
      }
    })

    // Tower crane: mast at the back corner; mast and jib live in the crane part, which the
    // runtime moves onto the mast axis so the jib can slew.
    if (c.crane) {
      b.span("crane", "concrete", "footing", [-0.6, -0.02, -0.6], [0.6, 0.3, 0.6])
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        b.cylinder("crane", "crane", `chord-${sx}${sz}`, 0.04, MAST_H - 0.3, [sx * 0.28, 0.3 + (MAST_H - 0.3) / 2, sz * 0.28], { segments: 6 })
      }
      for (let y = 1.2; y < MAST_H - 0.4; y += 1.2) {
        b.span("crane", "crane", `ring-${y.toFixed(1)}`, [-0.3, y - 0.03, -0.3], [0.3, y + 0.03, 0.3])
      }
      b.span("crane", "cab", "cab", [0.18, MAST_H - 0.1, -0.1], [0.78, MAST_H + 0.5, 0.5], { bevel: 0.03 })
      b.span("crane", "crane", "turntable", [-0.4, MAST_H - 0.2, -0.4], [0.4, MAST_H - 0.1, 0.4])
      const jibL = Math.min(9, Math.max(c.width, c.depth) + 1.5)
      b.span("crane", "crane", "jib", [-0.2, MAST_H + 0.5, -0.2], [0.2, MAST_H + 0.9, jibL])
      b.span("crane", "crane", "counter-jib", [-0.18, MAST_H + 0.55, -3], [0.18, MAST_H + 0.85, -0.2])
      b.span("crane", "weight", "counterweight", [-0.4, MAST_H + 0.1, -2.95], [0.4, MAST_H + 0.9, -2.2], { bevel: 0.03 })
      b.cylinder("crane", "crane", "apex", 0.05, 1.6, [0, MAST_H + 1.5 - 0.1, 0], { segments: 6 })
      b.cylinder("crane", "rebar", "hook-line", 0.01, 5, [0, MAST_H + 0.5 - 2.5, jibL * 0.65], { segments: 4 })
      b.span("crane", "weight", "hook-block", [-0.12, MAST_H - 4.8, jibL * 0.65 - 0.1], [0.12, MAST_H - 4.5, jibL * 0.65 + 0.1])
    }

    // Site clutter near the gate.
    b.cylinder("clutter", "sand", "sand", 0.9, 0.72, [hw - 1.3, 0.35, hd - 1.2], { radiusTop: 0.08, segments: 10 })
    b.span("clutter", "post", "pallet", [-hw + 0.8, -0.015, hd - 1.5], [-hw + 2.0, 0.12, hd - 0.7])
    for (let i = 0; i < 3; i++) b.span("clutter", "brick", `bricks-${i}`, [-hw + 0.85, 0.12 + i * 0.2, hd - 1.45], [-hw + 1.95, 0.31 + i * 0.2, hd - 0.75])
    const mx = gate + 0.9
    b.cylinder("clutter", "post", "mixer-leg", 0.04, 0.54, [mx, 0.25, hd - 2], { segments: 8 })
    b.cylinder("clutter", "mixer", "mixer-drum", 0.35, 0.7, [mx, 0.8, hd - 2], { radiusTop: 0.22, rot: [0.6, 0, 0], segments: 14 })
  },
  sockets: (c) => ({
    gate: { kind: "nav.enter", at: [0, 0, c.depth / 2 + 0.6] },
    sign: { kind: "ui.label", at: [1.4 + 0.3 + 1.1, 0.9, c.depth / 2 + 0.03] },
  }),
  actions: ({ parts, config }) => {
    let t = 0
    parts.crane.anchor.position.set(craneAt(config())[0], 0, craneAt(config())[1])
    parts.crane.anchor.rotation.y = 0.9
    return {
      actions: {} as Record<string, never>,
      update(dt: number) {
        t += dt
        const [x, z] = craneAt(config())
        parts.crane.anchor.position.set(x, 0, z)
        // The jib swings back and forth over the lot; the mast turns with it.
        parts.crane.anchor.rotation.y = 0.9 + Math.sin(t * 0.18) * 0.8
      },
    }
  },
}

export type ConstructionSite = ModelInstance<ConstructionSiteConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createConstructionSite(kit: ShopKit, config: Partial<ConstructionSiteConfig> = {}, materials: Partial<Record<string, Material>> = {}): ConstructionSite {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<ConstructionSiteConfig> = {}) {
  return createConstructionSite(kit, config)
}
