/**
 * @shop-kit/street-lamp — cast-iron street lantern: footed base, fluted post, cross arm
 * and a glazed lantern that glows. Pivot: ground centre of the base.
 */
import type { Group, Material, Mesh } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface StreetLampConfig {
  height: number
}

export interface StreetLampActions {
  setOn(on: boolean): void
}

export const streetLampDefinition: ModelDefinition<StreetLampConfig> = {
  id: "street-lamp",
  title: "Street Lamp",
  description: "Cast-iron lantern post with a glowing glazed head.",
  categories: ["exterior", "lighting", "street-furniture"],
  defaults: { height: 3.4 },
  fields: {
    height: { type: "number", min: 2.4, max: 5, step: 0.1, unit: "m", doc: "Height to the lantern base." },
  },
  materialSlots: ["iron", "glass"],
  parts: ["post", "lantern"],
  sockets: ["light"],
  actions: ["setOn"],
  envelope: (c) => ({ width: 0.4, depth: 0.4, height: c.height + 0.7 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<StreetLampConfig, StreetLampActions> = {
  definition: streetLampDefinition,
  slotMap: { iron: "hardware.steelDark", glass: "signal.warm" },
  build(b, c) {
    const h = c.height
    b.cylinder("post", "iron", "foot", 0.2, 0.12, [0, 0.06, 0], { radiusTop: 0.16, segments: 16 })
    b.cylinder("post", "iron", "base", 0.11, 0.6, [0, 0.42, 0], { radiusTop: 0.075, segments: 16 })
    b.cylinder("post", "iron", "shaft", 0.05, h - 0.72 - 0.1, [0, 0.72 + (h - 0.82) / 2, 0], { radiusTop: 0.04, segments: 12 })
    b.cylinder("post", "iron", "collar", 0.07, 0.1, [0, h - 0.05, 0], { segments: 12 })
    // Lantern: base plate, four glazed faces around a glowing core, cap and finial.
    b.cylinder("lantern", "iron", "plate", 0.2, 0.04, [0, h + 0.02, 0], { radiusTop: 0.16, segments: 4, rot: [0, Math.PI / 4, 0] })
    const core = b.cylinder("lantern", "glass", "glow", 0.13, 0.36, [0, h + 0.22, 0], { radiusTop: 0.16, segments: 4, rot: [0, Math.PI / 4, 0] })
    core.userData.vibe3dRole = "lamp.glow"
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      b.box("lantern", "iron", `rib-${i}`, [0.022, 0.4, 0.022], [Math.sin(a) * 0.145, h + 0.22, Math.cos(a) * 0.145], { rot: [Math.cos(a) * -0.08, 0, Math.sin(a) * 0.08] })
    }
    b.cylinder("lantern", "iron", "cap", 0.26, 0.14, [0, h + 0.47, 0], { radiusTop: 0.04, segments: 4, rot: [0, Math.PI / 4, 0] })
    b.cylinder("lantern", "iron", "finial", 0.018, 0.14, [0, h + 0.6, 0], { segments: 8 })
  },
  sockets: (c) => ({ light: { kind: "fx.light", at: [0, c.height + 0.2, 0] } }),
  actions: ({ parts }) => {
    let on = true
    const apply = () => parts.lantern.anchor.traverse((o) => {
      if (o.userData.vibe3dRole === "lamp.glow") (o as Mesh).visible = on
    })
    return { actions: { setOn(v: boolean) { on = v; apply() } }, update: apply }
  },
}

export type StreetLamp = ModelInstance<StreetLampConfig, Record<string, PartHandle<Group>>, StreetLampActions>

export function createStreetLamp(kit: ShopKit, config: Partial<StreetLampConfig> = {}, materials: Partial<Record<string, Material>> = {}): StreetLamp {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<StreetLampConfig> = {}) {
  return createStreetLamp(kit, config)
}
