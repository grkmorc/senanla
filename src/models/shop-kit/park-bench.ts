/**
 * @shop-kit/park-bench — slatted wooden bench on cast-iron legs with a backrest.
 * Pivot: ground centre. Sitters face +Z.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface ParkBenchConfig {
  length: number
}

export const parkBenchDefinition: ModelDefinition<ParkBenchConfig> = {
  id: "park-bench",
  title: "Park Bench",
  description: "Slatted wooden bench on cast-iron legs.",
  categories: ["exterior", "street-furniture"],
  defaults: { length: 1.8 },
  fields: { length: { type: "number", min: 1, max: 3, step: 0.1, unit: "m", doc: "Seat length." } },
  materialSlots: ["wood", "iron"],
  parts: ["frame", "slats"],
  sockets: [],
  actions: [],
  envelope: (c) => ({ width: c.length, depth: 0.62, height: 0.85 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<ParkBenchConfig, Record<string, never>> = {
  definition: parkBenchDefinition,
  slotMap: { wood: "surface.wood", iron: "hardware.steelDark" },
  build(b, c) {
    const hl = c.length / 2
    // Two iron side frames: front leg, rear leg rising into the back support, armrest.
    for (const s of [-1, 1]) {
      const x = s * (hl - 0.12)
      b.span("frame", "iron", `leg-f-${s}`, [x - 0.025, 0, 0.14], [x + 0.025, 0.42, 0.19])
      b.span("frame", "iron", `leg-b-${s}`, [x - 0.025, 0, -0.22], [x + 0.025, 0.42, -0.17])
      b.box("frame", "iron", `back-${s}`, [0.044, 0.46, 0.05], [x, 0.62, -0.2], { rot: [-0.18, 0, 0] })
      b.span("frame", "iron", `rail-${s}`, [x - 0.028, 0.38, -0.215], [x + 0.028, 0.41, 0.185])
      b.span("frame", "iron", `arm-${s}`, [x - 0.03, 0.62, -0.12], [x + 0.03, 0.65, 0.22], { bevel: 0.01 })
      b.span("frame", "iron", `arm-post-${s}`, [x - 0.02, 0.446, 0.155], [x + 0.02, 0.62, 0.185])
    }
    // Seat slats resting on the rails, backrest slats on the tilted supports.
    for (let i = 0; i < 4; i++) {
      const z = -0.17 + i * 0.1
      b.span("slats", "wood", `seat-${i}`, [-hl, 0.41, z], [hl, 0.445, z + 0.08], { bevel: 0.008 })
    }
    for (let i = 0; i < 3; i++) {
      b.box("slats", "wood", `back-${i}`, [c.length, 0.08, 0.03], [0, 0.55 + i * 0.12, -0.19 - i * 0.022 - 0.035], { rot: [-0.18, 0, 0], bevel: 0.008 })
    }
  },
  sockets: () => ({}),
}

export type ParkBench = ModelInstance<ParkBenchConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createParkBench(kit: ShopKit, config: Partial<ParkBenchConfig> = {}, materials: Partial<Record<string, Material>> = {}): ParkBench {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<ParkBenchConfig> = {}) {
  return createParkBench(kit, config)
}
