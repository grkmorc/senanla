/**
 * @shop-kit/planter — square stone planter with a capping rim and soil. The consumer puts
 * a plant on the `plant` socket (trees are app-level organic content).
 * Pivot: ground centre.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface PlanterConfig {
  size: number
  height: number
}

export const planterDefinition: ModelDefinition<PlanterConfig> = {
  id: "planter",
  title: "Planter",
  description: "Square stone planter with soil and a plant socket.",
  categories: ["exterior", "street-furniture"],
  defaults: { size: 1.1, height: 0.5 },
  fields: {
    size: { type: "number", min: 0.4, max: 3, step: 0.1, unit: "m", doc: "Outer side length." },
    height: { type: "number", min: 0.2, max: 1.2, step: 0.05, unit: "m", doc: "Wall height." },
  },
  materialSlots: ["stone", "rim", "soil"],
  parts: ["box", "soil"],
  sockets: ["plant"],
  actions: [],
  envelope: (c) => ({ width: c.size + 0.06, depth: c.size + 0.06, height: c.height + 0.05 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<PlanterConfig, Record<string, never>> = {
  definition: planterDefinition,
  slotMap: { stone: "surface.stoneDark", rim: "surface.stone", soil: "surface.soil" },
  build(b, c) {
    const h = c.size / 2
    const t = 0.08
    b.span("box", "stone", "wall-f", [-h, 0, h - t], [h, c.height, h])
    b.span("box", "stone", "wall-b", [-h, 0, -h], [h, c.height, -h + t])
    b.span("box", "stone", "wall-l", [-h, 0, -h + t], [-h + t, c.height, h - t])
    b.span("box", "stone", "wall-r", [h - t, 0, -h + t], [h, c.height, h - t])
    // Rim overhangs 30 mm outside and inside.
    b.span("box", "rim", "rim-f", [-h - 0.03, c.height, h - t - 0.03], [h + 0.03, c.height + 0.05, h + 0.03], { bevel: 0.01 })
    b.span("box", "rim", "rim-b", [-h - 0.03, c.height, -h - 0.03], [h + 0.03, c.height + 0.05, -h + t + 0.03], { bevel: 0.01 })
    b.span("box", "rim", "rim-l", [-h - 0.03, c.height + 0.001, -h + t + 0.03], [-h + t + 0.03, c.height + 0.049, h - t - 0.03], { bevel: 0.01 })
    b.span("box", "rim", "rim-r", [h - t - 0.03, c.height + 0.001, -h + t + 0.03], [h + 0.03, c.height + 0.049, h - t - 0.03], { bevel: 0.01 })
    b.span("soil", "soil", "soil", [-h + t, 0.01, -h + t], [h - t, c.height - 0.06, h - t])
  },
  sockets: (c) => ({ plant: { kind: "decor.plant", at: [0, c.height - 0.06, 0] } }),
}

export type Planter = ModelInstance<PlanterConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createPlanter(kit: ShopKit, config: Partial<PlanterConfig> = {}, materials: Partial<Record<string, Material>> = {}): Planter {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<PlanterConfig> = {}) {
  return createPlanter(kit, config)
}
