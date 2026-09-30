/**
 * @shop-kit/fountain — octagonal stone fountain: stepped plinth, basin wall with a wide
 * rim, water surface, a central column carrying a smaller bowl, and a water cap that
 * bobs gently. Pivot: ground centre.
 */
import type { Group, Material, Mesh } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface FountainConfig {
  radius: number
}

const OCT = { segments: 8, rot: [0, Math.PI / 8, 0] as [number, number, number] }

export const fountainDefinition: ModelDefinition<FountainConfig> = {
  id: "fountain",
  title: "Fountain",
  description: "Octagonal stone fountain with a tiered bowl and gently moving water.",
  categories: ["exterior", "decor", "landmark"],
  defaults: { radius: 1.6 },
  fields: { radius: { type: "number", min: 0.8, max: 4, step: 0.1, unit: "m", doc: "Basin outer radius." } },
  materialSlots: ["stone", "stoneDark", "water"],
  parts: ["basin", "column", "water"],
  sockets: [],
  actions: [],
  envelope: (c) => ({ width: c.radius * 2.2, depth: c.radius * 2.2, height: 1.9 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<FountainConfig, Record<string, never>> = {
  definition: fountainDefinition,
  slotMap: { stone: "surface.stone", stoneDark: "surface.stoneDark", water: "surface.water" },
  build(b, c) {
    const R = c.radius
    b.cylinder("basin", "stoneDark", "step", R * 1.08, 0.12, [0, 0.06, 0], { radiusTop: R * 1.06, ...OCT })
    b.cylinder("basin", "stone", "wall", R, 0.42, [0, 0.12 + 0.21, 0], { radiusTop: R * 0.98, ...OCT })
    b.cylinder("basin", "stoneDark", "rim", R * 1.02, 0.08, [0, 0.54 + 0.04 + 0.001, 0], { radiusTop: R * 1.02, ...OCT })
    b.cylinder("water", "water", "pool", R * 0.9, 0.02, [0, 0.52, 0], OCT)
    b.cylinder("column", "stone", "shaft", 0.16, 0.9, [0, 0.53 + 0.45, 0], { radiusTop: 0.12, segments: 12 })
    b.cylinder("column", "stoneDark", "bowl", R * 0.42, 0.14, [0, 1.48, 0], { radiusTop: R * 0.5, ...OCT })
    b.cylinder("water", "water", "bowl-water", R * 0.44, 0.02, [0, 1.555, 0], OCT)
    b.cylinder("column", "stone", "finial", 0.07, 0.24, [0, 1.555 + 0.12 + 0.01, 0], { radiusTop: 0.03, segments: 10 })
    const jet = b.cylinder("water", "water", "jet", 0.09, 0.18, [0, 1.9, 0], { radiusTop: 0.02, segments: 10 })
    jet.userData.vibe3dRole = "fountain.jet"
  },
  sockets: () => ({}),
  actions: ({ parts }) => {
    let t = 0
    return {
      actions: {} as Record<string, never>,
      update(dt: number) {
        t += dt
        parts.water.anchor.traverse((o) => {
          if (o.userData.vibe3dRole === "fountain.jet") (o as Mesh).scale.y = 0.8 + Math.sin(t * 3.1) * 0.25
        })
      },
    }
  },
}

export type Fountain = ModelInstance<FountainConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createFountain(kit: ShopKit, config: Partial<FountainConfig> = {}, materials: Partial<Record<string, Material>> = {}): Fountain {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<FountainConfig> = {}) {
  return createFountain(kit, config)
}
