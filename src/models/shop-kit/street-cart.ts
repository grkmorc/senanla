/**
 * @shop-kit/street-cart — Istanbul-style simit cart: painted body on two spoked wheels,
 * glazed display case with stacked simits and a row of water bottles, push handles and an
 * optional sun umbrella. `stock` (0..1) sets how full the case looks.
 * Pivot: ground centre of the body. Customers stand on the +Z side, the vendor at -Z.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface StreetCartConfig {
  stock: number
  umbrella: boolean
  tray: 1 | 2 | 3
  /** Tall pennant so the cart reads from across the street. */
  flag: boolean
}

const W = 1.3
const D = 0.8
const BODY_Y0 = 0.45
const BODY_Y1 = 0.95

export const streetCartDefinition: ModelDefinition<StreetCartConfig> = {
  id: "street-cart",
  title: "Street Cart",
  description: "Two-wheeled simit cart with a glazed display case, handles and an optional umbrella.",
  categories: ["props", "street", "retail"],
  defaults: { stock: 1, umbrella: false, tray: 1, flag: true },
  fields: {
    stock: { type: "number", min: 0, max: 1, step: 0.05, doc: "How full the display case is." },
    umbrella: { type: "boolean", doc: "Sun umbrella over the cart." },
    tray: { type: "integer", min: 1, max: 3, step: 1, unit: "count", doc: "Display tiers (bigger tray upgrades)." },
    flag: { type: "boolean", doc: "Tall pennant on a pole at the front corner." },
  },
  materialSlots: ["body", "trim", "frame", "glass", "simit", "bottle", "cap", "tyre", "hub", "canopy", "canopyAlt"],
  parts: ["body", "wheels", "case", "goods", "umbrella", "flag"],
  sockets: ["customer", "vendor", "sign"],
  actions: [],
  envelope: (c) => ({ width: c.umbrella ? 2.2 : 1.9, depth: c.umbrella ? 2.2 : 1.5, height: c.umbrella ? 2.4 : 1.6 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<StreetCartConfig, Record<string, never>> = {
  definition: streetCartDefinition,
  slotMap: {
    body: "prop.goodsA", trim: "surface.awningLight", frame: "hardware.steel", glass: "surface.carGlass",
    simit: "prop.simit", bottle: "prop.bottle", cap: "prop.goodsC", tyre: "surface.rubber", hub: "hardware.steelDark",
    canopy: "prop.goodsA", canopyAlt: "surface.awningLight",
  },
  build(b, c) {
    const hw = W / 2
    const hd = D / 2
    // Body: painted box with a white band and a lower shelf between the wheels.
    b.span("body", "body", "body", [-hw, BODY_Y0, -hd], [hw, BODY_Y1, hd], { bevel: 0.03 })
    b.span("body", "trim", "band-front", [-hw + 0.04, BODY_Y1 - 0.14, hd], [hw - 0.04, BODY_Y1 - 0.06, hd + 0.012])
    b.span("body", "trim", "band-back", [-hw + 0.04, BODY_Y1 - 0.14, -hd - 0.012], [hw - 0.04, BODY_Y1 - 0.06, -hd])
    b.span("body", "frame", "top-rim", [-hw - 0.02, BODY_Y1, -hd - 0.02], [hw + 0.02, BODY_Y1 + 0.03, hd + 0.02], { bevel: 0.01 })
    // Front leg and rear push handles.
    b.cylinder("body", "frame", "leg", 0.025, BODY_Y0 - 0.015, [0, (BODY_Y0 + 0.015) / 2, hd - 0.12], { segments: 10 })
    b.cylinder("body", "frame", "foot", 0.07, 0.03, [0, 0.015, hd - 0.12], { segments: 12 })
    for (const s of [-1, 1]) {
      b.cylinder("body", "frame", `handle-${s}`, 0.022, 0.5, [s * (hw - 0.12), BODY_Y1 - 0.08, -hd - 0.22], { rot: [Math.PI / 2 - 0.25, 0, 0], segments: 10 })
      b.cylinder("body", "tyre", `grip-${s}`, 0.03, 0.14, [s * (hw - 0.12), BODY_Y1 - 0.02, -hd - 0.47], { rot: [Math.PI / 2 - 0.25, 0, 0], segments: 10 })
    }

    // Two spoked wheels on the sides.
    const R = 0.34
    for (const s of [-1, 1]) {
      const x = s * (hw + 0.07)
      b.torus("wheels", "tyre", `tyre-${s}`, R - 0.03, 0.035, [x, R, -0.05], { rot: [0, 0, Math.PI / 2], segments: 24 })
      b.cylinder("wheels", "hub", `hub-${s}`, 0.05, 0.08, [x, R, -0.05], { rot: [0, 0, Math.PI / 2], segments: 12 })
      for (let k = 0; k < 4; k++) {
        // Stagger spokes by 1 mm so their flat sides never share a plane.
        b.box("wheels", "frame", `spoke-${s}-${k}`, [0.016, (R - 0.05) * 2 - k * 0.004, 0.016 + k * 0.001], [x + (k - 1.5) * 0.0015, R, -0.05], { rot: [(k * Math.PI) / 4, 0, 0] })
      }
    }
    b.cylinder("wheels", "frame", "axle", 0.018, W + 0.14, [0, R, -0.05], { rot: [0, 0, Math.PI / 2], segments: 8 })

    // Display case: glass box with corner posts; tiers stack inside.
    const caseY0 = BODY_Y1 + 0.03
    const caseH = 0.22 + c.tray * 0.14
    const caseY1 = caseY0 + caseH
    b.span("case", "glass", "glass", [-hw + 0.06, caseY0, -hd + 0.06], [hw - 0.06, caseY1, hd - 0.06])
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.span("case", "frame", `post-${sx}${sz}`,
        [sx * (hw - 0.06) - 0.018, caseY0 + 0.001, sz * (hd - 0.06) - 0.018], [sx * (hw - 0.06) + 0.018, caseY1 + 0.001, sz * (hd - 0.06) + 0.018])
    }
    b.span("case", "trim", "lid", [-hw + 0.03, caseY1, -hd + 0.03], [hw - 0.03, caseY1 + 0.04, hd - 0.03], { bevel: 0.012 })

    // Goods: simits stacked on each tier (drawn above the glass box so they read from the
    // isometric view), bottles in a row along the front edge of the rim.
    const perTier = 8
    const total = Math.round(c.stock * perTier * c.tray)
    let n = 0
    for (let t = 0; t < c.tray && n < total; t++) {
      const y = caseY1 + 0.06 + t * 0.045
      for (let i = 0; i < perTier && n < total; i++, n++) {
        const col = i % 4
        const row = Math.floor(i / 4)
        const x = -hw + 0.24 + col * 0.27 + (t % 2) * 0.1
        const z = -0.1 + row * 0.22 - (t % 2) * 0.05
        b.torus("goods", "simit", `simit-${t}-${i}`, 0.085, 0.028, [x, y, z], { rot: [0, b.random() * 3, 0], segments: 14 })
      }
    }
    const bottles = Math.round(c.stock * 6)
    for (let i = 0; i < bottles; i++) {
      const x = -hw + 0.2 + i * 0.18
      b.cylinder("goods", "bottle", `bottle-${i}`, 0.035, 0.2, [x, BODY_Y1 + 0.13, hd + 0.07], { segments: 10 })
      b.cylinder("goods", "cap", `cap-${i}`, 0.018, 0.03, [x, BODY_Y1 + 0.245, hd + 0.07], { segments: 8 })
    }
    b.span("goods", "frame", "bottle-ledge", [-hw + 0.08, BODY_Y1 - 0.04, hd + 0.012], [hw - 0.08, BODY_Y1 + 0.029, hd + 0.13])

    if (c.flag) {
      // Pole at the front-left corner, pennant flying towards -X.
      const px = -hw + 0.1
      const pz = hd - 0.1
      const top = 2.75
      b.cylinder("flag", "frame", "flag-pole", 0.02, top - BODY_Y1 - 0.015, [px, BODY_Y1 + 0.015 + (top - BODY_Y1 - 0.015) / 2, pz], { segments: 8 })
      b.cylinder("flag", "frame", "flag-knob", 0.035, 0.05, [px, top + 0.025, pz], { segments: 10 })
      b.span("flag", "canopy", "pennant", [px - 0.02 - 0.75, top - 0.52, pz - 0.006], [px - 0.02, top - 0.05, pz + 0.006])
      b.span("flag", "canopyAlt", "pennant-band", [px - 0.02 - 0.75, top - 0.34, pz + 0.006], [px - 0.02, top - 0.23, pz + 0.012])
      b.span("flag", "canopyAlt", "pennant-band-b", [px - 0.02 - 0.75, top - 0.34, pz - 0.012], [px - 0.02, top - 0.23, pz - 0.006])
    }

    if (c.umbrella) {
      const top = 2.3
      b.cylinder("umbrella", "frame", "pole", 0.022, top - BODY_Y1 - 0.015, [hw - 0.12, BODY_Y1 + 0.015 + (top - BODY_Y1 - 0.015) / 2, -hd + 0.12], { segments: 8 })
      b.cylinder("umbrella", "canopy", "canopy", 1.05, 0.32, [hw - 0.12, top - 0.1, -hd + 0.12], { radiusTop: 0.04, segments: 8 })
      b.cylinder("umbrella", "canopyAlt", "valance", 1.06, 0.08, [hw - 0.12, top - 0.3, -hd + 0.12], { segments: 8 })
      b.cylinder("umbrella", "frame", "finial", 0.03, 0.08, [hw - 0.12, top + 0.1, -hd + 0.12], { segments: 8 })
    }
  },
  sockets: () => ({
    customer: { kind: "nav.interact", at: [0, 0, D / 2 + 0.75] },
    vendor: { kind: "nav.stand", at: [0, 0, -D / 2 - 0.7] },
    sign: { kind: "ui.label", at: [0, 1.75, 0] },
  }),
}

export type StreetCart = ModelInstance<StreetCartConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createStreetCart(kit: ShopKit, config: Partial<StreetCartConfig> = {}, materials: Partial<Record<string, Material>> = {}): StreetCart {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<StreetCartConfig> = {}) {
  return createStreetCart(kit, config)
}
