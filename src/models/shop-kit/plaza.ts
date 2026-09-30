/**
 * @shop-kit/plaza — a small paved square: stone kerb border, a checker of light and dark
 * slabs, and a circular inlay ring around the centre. Walking level is its top (35 mm).
 * Pivot: ground centre.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface PlazaConfig {
  width: number
  depth: number
  slab: number
  /** Radius of the inlay ring around the centre (0 = none). */
  ring: number
  /** Offset of the ring centre along Z. */
  ringZ: number
}

export const PLAZA_TOP = 0.035

export const plazaDefinition: ModelDefinition<PlazaConfig> = {
  id: "plaza",
  title: "Plaza Paving",
  description: "Stone-paved square with a kerb border and a circular inlay.",
  categories: ["exterior", "ground"],
  defaults: { width: 10, depth: 9, slab: 1, ring: 2.4, ringZ: 0 },
  fields: {
    width: { type: "number", min: 3, max: 40, step: 0.5, unit: "m", doc: "Plaza width (X)." },
    depth: { type: "number", min: 3, max: 40, step: 0.5, unit: "m", doc: "Plaza depth (Z)." },
    slab: { type: "number", min: 0.5, max: 2, step: 0.25, unit: "m", doc: "Paving slab size." },
    ring: { type: "number", min: 0, max: 8, step: 0.1, unit: "m", doc: "Inlay ring radius." },
    ringZ: { type: "number", min: -20, max: 20, step: 0.1, unit: "m", doc: "Inlay ring centre Z." },
  },
  materialSlots: ["base", "slab", "slabAlt", "kerb", "inlay"],
  parts: ["base", "slabs", "kerb"],
  sockets: [],
  actions: [],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: PLAZA_TOP }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<PlazaConfig, Record<string, never>> = {
  definition: plazaDefinition,
  slotMap: { base: "surface.stoneDark", slab: "surface.stone", slabAlt: "surface.stoneDark", kerb: "surface.curb", inlay: "surface.curb" },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    const k = 0.25 // kerb width
    const g = 0.012 // grout
    b.span("base", "base", "base", [-hw + k, 0, -hd + k], [hw - k, 0.02, hd - k])
    // Kerb frame, 10 mm above the slabs; the front and back runs own the corners.
    b.span("kerb", "kerb", "kerb-f", [-hw, 0, hd - k], [hw, PLAZA_TOP + 0.01, hd], { bevel: 0.01 })
    b.span("kerb", "kerb", "kerb-b", [-hw, 0, -hd], [hw, PLAZA_TOP + 0.01, -hd + k], { bevel: 0.01 })
    b.span("kerb", "kerb", "kerb-l", [-hw, 0, -hd + k], [-hw + k, PLAZA_TOP + 0.01, hd - k], { bevel: 0.01 })
    b.span("kerb", "kerb", "kerb-r", [hw - k, 0, -hd + k], [hw, PLAZA_TOP + 0.01, hd - k], { bevel: 0.01 })
    // Slabs in a checker, skipping the ones under the inlay ring.
    const x0 = -hw + k
    const z0 = -hd + k
    const nx = Math.floor((c.width - 2 * k) / c.slab + 1e-6)
    const nz = Math.floor((c.depth - 2 * k) / c.slab + 1e-6)
    const sx = (c.width - 2 * k) / nx
    const sz = (c.depth - 2 * k) / nz
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const ax = x0 + i * sx + g / 2
        const az = z0 + j * sz + g / 2
        const alt = (i + j) % 2 === 1
        b.span("slabs", alt ? "slabAlt" : "slab", `slab-${i}-${j}`, [ax, 0.02, az], [ax + sx - g, PLAZA_TOP, az + sz - g], { bevel: 0.004 })
      }
    }
    if (c.ring > 0) {
      // Thin dark ring inlaid just proud of the slabs.
      b.torus("slabs", "inlay", "inlay-ring", c.ring, 0.05, [0, PLAZA_TOP + 0.003, c.ringZ], { segments: 48 })
    }
  },
  sockets: () => ({}),
}

export type Plaza = ModelInstance<PlazaConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createPlaza(kit: ShopKit, config: Partial<PlazaConfig> = {}, materials: Partial<Record<string, Material>> = {}): Plaza {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<PlazaConfig> = {}) {
  return createPlaza(kit, config)
}
