/**
 * @shop-kit/shop-building — street-facing shop exterior: plinth, facade, recessed door,
 * framed windows (or a roller shutter), striped awning, sign board, parapet roof with AC unit.
 * Pivot: ground centre of the footprint. The street / entrance faces +Z.
 * Sign text is left to the consumer (the `sign` socket marks the board centre).
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, type Builder, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface ShopBuildingConfig {
  width: number
  depth: number
  height: number
  doorWidth: number
  facade: "plaster" | "brick" | "metal"
  awning: "teal" | "amber" | "red" | "none"
  shutter: boolean
}

const PLINTH = 0.15
const DOOR_H = 2.3

export const shopBuildingDefinition: ModelDefinition<ShopBuildingConfig> = {
  id: "shop-building",
  title: "Shop Building",
  description: "Single-storey shop exterior with door, windows or shutter, striped awning and a blank sign board.",
  categories: ["architecture", "exterior", "signage"],
  defaults: { width: 8, depth: 7, height: 4, doorWidth: 1.4, facade: "plaster", awning: "teal", shutter: false },
  fields: {
    width: { type: "number", min: 4, max: 16, step: 0.5, unit: "m", doc: "Frontage width." },
    depth: { type: "number", min: 4, max: 16, step: 0.5, unit: "m", doc: "Building depth." },
    height: { type: "number", min: 3.2, max: 6, step: 0.1, unit: "m", doc: "Facade height to the roof deck." },
    doorWidth: { type: "number", min: 1, max: 2.4, step: 0.1, unit: "m", doc: "Door opening width." },
    facade: { type: "enum", options: ["plaster", "brick", "metal"], doc: "Facade finish; metal adds corrugation ribs." },
    awning: { type: "enum", options: ["teal", "amber", "red", "none"], doc: "Striped awning colour over the windows." },
    shutter: { type: "boolean", doc: "Replace the right window with a roller shutter bay." },
  },
  materialSlots: ["plaster", "brick", "metal", "plinth", "roof", "trim", "glass", "door", "sign", "awningLight", "awningTeal", "awningAmber", "awningRed", "hardware"],
  parts: ["shell", "openings", "awning", "sign", "roof"],
  sockets: ["door", "sign"],
  actions: [],
  envelope: (c) => ({ width: c.width + 0.1, depth: c.depth + 1.1, height: c.height + 0.8 }),
  capabilities: ["webgl"],
}

/** Window with a 60 mm frame 30 mm proud, glass 12 mm proud, and a sill. */
function frontWindow(b: Builder, label: string, x0: number, x1: number, y0: number, y1: number, z: number) {
  const f = 0.06
  b.span("openings", "glass", `${label}-glass`, [x0 + f, y0 + f, z + 0.002], [x1 - f, y1 - f, z + 0.012])
  b.span("openings", "trim", `${label}-frame-l`, [x0, y0, z], [x0 + f, y1, z + 0.03])
  b.span("openings", "trim", `${label}-frame-r`, [x1 - f, y0, z], [x1, y1, z + 0.03])
  b.span("openings", "trim", `${label}-frame-t`, [x0 + f, y1 - f, z], [x1 - f, y1, z + 0.03])
  b.span("openings", "trim", `${label}-frame-b`, [x0 + f, y0, z], [x1 - f, y0 + f, z + 0.03])
  // Mullion splits wide windows.
  if (x1 - x0 > 1.4) b.span("openings", "trim", `${label}-mullion`, [(x0 + x1) / 2 - 0.025, y0 + f + 0.001, z + 0.001], [(x0 + x1) / 2 + 0.025, y1 - f - 0.001, z + 0.025])
  b.span("openings", "plinth", `${label}-sill`, [x0 - 0.05, y0 - 0.06, z], [x1 + 0.05, y0 - 0.001, z + 0.08])
}

const spec: ShopModelSpec<ShopBuildingConfig, Record<string, never>> = {
  definition: shopBuildingDefinition,
  slotMap: {
    plaster: "surface.plaster",
    brick: "surface.brick",
    metal: "surface.corrugated",
    plinth: "surface.curb",
    roof: "surface.roof",
    trim: "hardware.steelDark",
    glass: "surface.glass",
    door: "surface.woodDark",
    sign: "surface.woodDark",
    awningLight: "surface.awningLight",
    awningTeal: "surface.paint",
    awningAmber: "prop.goodsB",
    awningRed: "prop.goodsA",
    hardware: "hardware.steel",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    const fz = hd // facade plane
    const skin = c.facade

    // Plinth course, 40 mm proud all round; shell above it.
    b.span("shell", "plinth", "plinth", [-hw - 0.04, 0, -hd - 0.04], [hw + 0.04, PLINTH, hd + 0.04])
    b.span("shell", skin, "body", [-hw, PLINTH, -hd], [hw, c.height, hd])
    // Corner pilasters frame the facade.
    for (const s of [-1, 1]) {
      b.span("shell", "trim", `pilaster-${s}`, [s < 0 ? -hw - 0.03 : hw - 0.22, PLINTH - 0.001, fz - 0.19], [s < 0 ? -hw + 0.22 : hw + 0.03, c.height + 0.001, fz + 0.035])
    }
    if (skin === "metal") {
      // Vertical corrugation ribs on both side walls.
      for (const s of [-1, 1]) {
        for (let z = -hd + 0.25; z < hd - 0.3; z += 0.32) {
          b.span("shell", "metal", `rib-${s}-${z.toFixed(2)}`,
            s < 0 ? [-hw - 0.025, PLINTH + 0.05, z] : [hw, PLINTH + 0.05, z],
            s < 0 ? [-hw, c.height - 0.05, z + 0.06] : [hw + 0.025, c.height - 0.05, z + 0.06])
        }
      }
    }

    // Door: frame proud 50 mm, dark leaf with glazing, push bar.
    const dw = c.doorWidth / 2
    b.span("openings", "trim", "door-frame-l", [-dw - 0.08, PLINTH, fz], [-dw, DOOR_H + 0.08, fz + 0.05])
    b.span("openings", "trim", "door-frame-r", [dw, PLINTH, fz], [dw + 0.08, DOOR_H + 0.08, fz + 0.05])
    b.span("openings", "trim", "door-head", [-dw, DOOR_H, fz], [dw, DOOR_H + 0.08, fz + 0.05])
    b.span("openings", "door", "door-leaf", [-dw, PLINTH, fz], [dw, DOOR_H, fz + 0.02])
    b.span("openings", "glass", "door-glass", [-dw + 0.12, 1.0, fz + 0.02], [dw - 0.12, DOOR_H - 0.15, fz + 0.03])
    b.span("openings", "hardware", "push-bar", [-dw + 0.15, 1.02, fz + 0.045], [dw - 0.15, 1.06, fz + 0.075], { bevel: 0.012 })
    b.span("openings", "plinth", "threshold", [-dw - 0.1, 0, fz + 0.04], [dw + 0.1, PLINTH + 0.02, fz + 0.45])

    // Windows either side of the door.
    const gap = 0.45
    const leftX0 = -hw + 0.4
    const leftX1 = -dw - gap
    const rightX0 = dw + gap
    const rightX1 = hw - 0.4
    frontWindow(b, "win-l", leftX0, leftX1, 0.9, 2.35, fz)
    if (c.shutter) {
      // Roller shutter bay: housing box + horizontal slats.
      b.span("openings", "trim", "shutter-box", [rightX0 - 0.05, 2.45, fz], [rightX1 + 0.05, 2.7, fz + 0.18], { bevel: 0.01 })
      for (let y = PLINTH + 0.02, i = 0; y + 0.095 <= 2.44; y += 0.11, i++) {
        b.span("openings", "hardware", `slat-${i}`, [rightX0, y, fz], [rightX1, y + 0.095, fz + 0.03])
      }
    } else frontWindow(b, "win-r", rightX0, rightX1, 0.9, 2.35, fz)

    // Striped awning over the whole frontage, tilted 18° down towards the street.
    if (c.awning !== "none") {
      const colour = c.awning === "teal" ? "awningTeal" : c.awning === "amber" ? "awningAmber" : "awningRed"
      const depthA = 1.0
      const tilt = 0.32
      const yTop = 2.85
      const stripes = Math.max(6, Math.round((c.width - 0.4) / 0.45))
      const sw = (c.width - 0.4) / stripes
      const cz = fz + Math.cos(tilt) * depthA / 2
      const cy = yTop - Math.sin(tilt) * depthA / 2
      for (let i = 0; i < stripes; i++) {
        const x = -hw + 0.2 + (i + 0.5) * sw
        b.box("awning", i % 2 ? "awningLight" : colour, `stripe-${i}`, [sw, 0.03, depthA], [x, cy, cz], { rot: [tilt, 0, 0] })
      }
      // Valance: short flap hanging from the front edge.
      const fzA = fz + Math.cos(tilt) * depthA
      const fyA = yTop - Math.sin(tilt) * depthA
      for (let i = 0; i < stripes; i++) {
        const x = -hw + 0.2 + (i + 0.5) * sw
        b.span("awning", i % 2 ? "awningLight" : colour, `valance-${i}`, [x - sw / 2 + 0.001, fyA - 0.2, fzA - 0.02], [x + sw / 2 - 0.001, fyA, fzA + 0.005])
      }
      for (const s of [-1, 1]) {
        b.cylinder("awning", "hardware", `arm-${s}`, 0.012, depthA * 1.02, [s * (hw - 0.3), cy - 0.04, cz], { rot: [Math.PI / 2 + tilt, 0, 0] })
      }
    }

    // Sign board above the awning; text is a consumer overlay at the `sign` socket.
    const signW = Math.min(c.width - 1.2, 5.2)
    b.span("sign", "sign", "sign-board", [-signW / 2, c.height - 0.95, fz], [signW / 2, c.height - 0.25, fz + 0.08], { bevel: 0.015 })
    b.span("sign", "hardware", "sign-trim", [-signW / 2 - 0.03, c.height - 0.99, fz], [signW / 2 + 0.03, c.height - 0.95, fz + 0.1])

    // Roof: membrane inset inside a 300 mm parapet; AC unit and vent.
    const p = 0.14
    b.span("roof", "roof", "membrane", [-hw + p, c.height, -hd + p], [hw - p, c.height + 0.03, hd - p])
    b.span("roof", "plinth", "parapet-front", [-hw - 0.02, c.height, hd - p], [hw + 0.02, c.height + 0.3, hd + 0.04])
    b.span("roof", "plinth", "parapet-back", [-hw - 0.02, c.height, -hd - 0.04], [hw + 0.02, c.height + 0.3, -hd + p])
    b.span("roof", "plinth", "parapet-left", [-hw - 0.02, c.height, -hd + p], [-hw + p, c.height + 0.3, hd - p])
    b.span("roof", "plinth", "parapet-right", [hw - p, c.height, -hd + p], [hw + 0.02, c.height + 0.3, hd - p])
    b.span("roof", "hardware", "ac-unit", [-hw + 0.8, c.height + 0.03, -hd + 0.8], [-hw + 1.9, c.height + 0.75, -hd + 1.6], { bevel: 0.03 })
    b.cylinder("roof", "trim", "ac-fan", 0.3, 0.02, [-hw + 1.35, c.height + 0.76, -hd + 1.2], { segments: 24 })
    b.cylinder("roof", "hardware", "vent", 0.12, 0.5, [hw - 1.2, c.height + 0.28, -hd + 1.0], { segments: 16 })
  },
  sockets: (c) => ({
    door: { kind: "nav.enter", at: [0, 0, c.depth / 2 + 0.8] },
    sign: { kind: "ui.label", at: [0, c.height - 0.6, c.depth / 2 + 0.1] },
  }),
}

export type ShopBuilding = ModelInstance<ShopBuildingConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createShopBuilding(kit: ShopKit, config: Partial<ShopBuildingConfig> = {}, materials: Partial<Record<string, Material>> = {}): ShopBuilding {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<ShopBuildingConfig> = {}) {
  return createShopBuilding(kit, config)
}
