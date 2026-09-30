/**
 * @shop-kit/rooftop-sign — a big two-faced sign box on steel legs, standing on a flat roof
 * behind the parapet so it reads from across the city. The faces are left blank: the
 * consumer mounts its lettering (an LED face) on the `front` and `back` sockets.
 * Pivot: roof surface under the centre of the box. `front` faces +Z, `back` faces -Z.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface RooftopSignConfig {
  width: number
  height: number
  /** Clearance between the roof and the bottom of the box. */
  lift: number
}

const DEPTH = 0.22

export const rooftopSignDefinition: ModelDefinition<RooftopSignConfig> = {
  id: "rooftop-sign",
  title: "Rooftop Sign",
  description: "Two-faced sign box on steel legs for flat roofs; faces are blank for consumer lettering.",
  categories: ["exterior", "signage"],
  defaults: { width: 6, height: 1.4, lift: 0.55 },
  fields: {
    width: { type: "number", min: 1.5, max: 12, step: 0.1, unit: "m", doc: "Box width." },
    height: { type: "number", min: 0.6, max: 3, step: 0.05, unit: "m", doc: "Box height." },
    lift: { type: "number", min: 0.2, max: 2, step: 0.05, unit: "m", doc: "Leg height below the box." },
  },
  materialSlots: ["box", "frame", "leg"],
  parts: ["legs", "box"],
  sockets: ["front", "back"],
  actions: [],
  envelope: (c) => ({ width: c.width + 0.1, depth: 0.9, height: c.lift + c.height + 0.05 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<RooftopSignConfig, Record<string, never>> = {
  definition: rooftopSignDefinition,
  slotMap: { box: "surface.rubber", frame: "hardware.steelDark", leg: "hardware.steel" },
  build(b, c) {
    const hw = c.width / 2
    const hd = DEPTH / 2
    const y0 = c.lift
    const y1 = c.lift + c.height
    // Box with a frame that stands 20 mm proud of the faces all round.
    b.span("box", "box", "box", [-hw, y0, -hd], [hw, y1, hd])
    const f = 0.06
    b.span("box", "frame", "frame-top", [-hw - 0.03, y1, -hd - 0.02], [hw + 0.03, y1 + f, hd + 0.02])
    b.span("box", "frame", "frame-bottom", [-hw - 0.03, y0 - f, -hd - 0.02], [hw + 0.03, y0, hd + 0.02])
    b.span("box", "frame", "frame-l", [-hw - 0.03, y0, -hd - 0.02], [-hw, y1, hd + 0.02])
    b.span("box", "frame", "frame-r", [hw, y0, -hd - 0.02], [hw + 0.03, y1, hd + 0.02])
    // Legs with rear braces, one pair every ~2.5 m.
    const n = Math.max(2, Math.round(c.width / 2.5) + 1)
    for (let i = 0; i < n; i++) {
      const x = -hw + 0.3 + ((c.width - 0.6) * i) / (n - 1)
      b.span("legs", "leg", `leg-${i}`, [x - 0.04, 0.03, -0.04], [x + 0.04, y0 - f, 0.04])
      const len = Math.hypot(y0 - f, 0.55)
      b.box("legs", "leg", `brace-${i}`, [0.035, len, 0.035], [x + 0.001, (y0 - f) / 2, -0.275], { rot: [Math.atan2(0.55, y0 - f), 0, 0] })
      b.span("legs", "frame", `foot-${i}`, [x - 0.1, 0, -0.66], [x + 0.1, 0.03, 0.1])
    }
  },
  sockets: (c) => ({
    front: { kind: "ui.label", at: [0, c.lift + c.height / 2, DEPTH / 2] },
    back: { kind: "ui.label", at: [0, c.lift + c.height / 2, -DEPTH / 2] },
  }),
}

export type RooftopSign = ModelInstance<RooftopSignConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createRooftopSign(kit: ShopKit, config: Partial<RooftopSignConfig> = {}, materials: Partial<Record<string, Material>> = {}): RooftopSign {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<RooftopSignConfig> = {}) {
  return createRooftopSign(kit, config)
}
