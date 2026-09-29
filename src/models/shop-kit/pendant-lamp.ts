/**
 * @shop-kit/pendant-lamp — ceiling pendant: canopy, cord, metal dome shade, glowing diffuser.
 * Pivot: floor point directly under the lamp (so it places like floor furniture).
 * Hangs above head height; consumers usually leave it out of navigation blocking.
 */
import type { Group, Material, Mesh } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface PendantLampConfig {
  ceiling: number
  drop: number
  radius: number
}

export interface PendantLampActions {
  setOn(on: boolean): void
  readonly on: boolean
}

export const pendantLampDefinition: ModelDefinition<PendantLampConfig> = {
  id: "pendant-lamp",
  title: "Pendant Lamp",
  description: "Industrial dome pendant on a cord with a switchable warm diffuser.",
  categories: ["lighting", "fixture"],
  defaults: { ceiling: 2.8, drop: 0.7, radius: 0.24 },
  fields: {
    ceiling: { type: "number", min: 2.2, max: 5, step: 0.1, unit: "m", doc: "Ceiling height the cord hangs from." },
    drop: { type: "number", min: 0.2, max: 2, step: 0.05, unit: "m", doc: "Cord length from canopy to shade top." },
    radius: { type: "number", min: 0.12, max: 0.5, step: 0.02, unit: "m", doc: "Shade rim radius." },
  },
  materialSlots: ["metal", "shade", "diffuser"],
  parts: ["canopy", "cord", "shade", "bulb"],
  sockets: ["light"],
  actions: ["setOn"],
  envelope: (c) => ({ width: c.radius * 2, depth: c.radius * 2, height: c.ceiling }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<PendantLampConfig, PendantLampActions> = {
  definition: pendantLampDefinition,
  slotMap: { metal: "hardware.steelDark", shade: "surface.shade", diffuser: "signal.warm" },
  build(b, c) {
    const top = c.ceiling
    const shadeTop = top - 0.03 - c.drop
    const r = c.radius
    b.cylinder("canopy", "metal", "canopy", 0.06, 0.03, [0, top - 0.015, 0], { radiusTop: 0.05, segments: 20 })
    b.cylinder("cord", "metal", "cord", 0.005, c.drop, [0, top - 0.03 - c.drop / 2, 0], { segments: 8 })
    // Socket collar, then dome in two frustums for a rounded profile.
    b.cylinder("shade", "metal", "collar", 0.028, 0.07, [0, shadeTop - 0.035, 0], { segments: 16 })
    b.cylinder("shade", "shade", "dome-upper", r * 0.55, 0.07, [0, shadeTop - 0.1, 0], { radiusTop: r * 0.22, segments: 28 })
    b.cylinder("shade", "shade", "dome-lower", r, r * 0.45, [0, shadeTop - 0.135 - r * 0.225, 0], { radiusTop: r * 0.55, segments: 32 })
    const rimY = shadeTop - 0.135 - r * 0.45
    b.cylinder("shade", "metal", "rim", r + 0.006, 0.014, [0, rimY + 0.005, 0], { radiusTop: r + 0.006, segments: 32 })
    // Diffuser: a thick glowing puck hanging 4 mm below the rim, so its side glows
    // from the downward isometric view where the shade hides the underside.
    const d = b.cylinder("bulb", "diffuser", "diffuser", r * 0.46, 0.05, [0, rimY - 0.029, 0], { radiusTop: r * 0.5, segments: 32 })
    d.userData.vibe3dRole = "pendant.diffuser"
  },
  sockets: (c) => ({ light: { kind: "fx.light", at: [0, c.ceiling - 0.03 - c.drop - 0.2 - c.radius * 0.45, 0] } }),
  actions: ({ parts }) => {
    let on = true
    const apply = () => {
      parts.bulb.anchor.traverse((o) => { if (o.userData.vibe3dRole === "pendant.diffuser") (o as Mesh).visible = on })
      parts.bulb.anchor.traverse((o) => { if (o.userData.vibe3dRole === "pendant.light") o.visible = on })
    }
    return {
      actions: {
        setOn(v: boolean) { on = v; apply() },
        get on() { return on },
      },
      update: apply,
    }
  },
}

export type PendantLamp = ModelInstance<PendantLampConfig, Record<string, PartHandle<Group>>, PendantLampActions>

export function createPendantLamp(kit: ShopKit, config: Partial<PendantLampConfig> = {}, materials: Partial<Record<string, Material>> = {}): PendantLamp {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<PendantLampConfig> = {}) {
  return createPendantLamp(kit, config)
}
