/**
 * @shop-kit/traffic-light — signal post with a three-lamp head facing +Z and a
 * pedestrian lamp. Only the active lamp glows; the others show dark lenses.
 * Pivot: ground centre of the post.
 */
import type { Group, Material, Mesh } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export type Signal = "green" | "amber" | "red"

export interface TrafficLightConfig {
  height: number
}

export interface TrafficLightActions {
  setSignal(s: Signal): void
  readonly signal: Signal
}

export const trafficLightDefinition: ModelDefinition<TrafficLightConfig> = {
  id: "traffic-light",
  title: "Traffic Light",
  description: "Three-aspect traffic signal on a post, with a pedestrian lamp.",
  categories: ["street-furniture", "signage", "lighting"],
  defaults: { height: 2.6 },
  fields: { height: { type: "number", min: 2, max: 4, step: 0.1, unit: "m", doc: "Height to the bottom of the signal head." } },
  materialSlots: ["post", "housing", "lens", "red", "amber", "green", "walk"],
  parts: ["post", "head", "lamps"],
  sockets: [],
  actions: ["setSignal"],
  envelope: (c) => ({ width: 0.4, depth: 0.4, height: c.height + 0.95 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<TrafficLightConfig, TrafficLightActions> = {
  definition: trafficLightDefinition,
  slotMap: {
    post: "hardware.steelDark", housing: "surface.roof", lens: "surface.rubber",
    red: "signal.red", amber: "signal.amber", green: "signal.green", walk: "signal.green",
  },
  build(b, c) {
    const h = c.height
    b.cylinder("post", "post", "base", 0.14, 0.1, [0, 0.05, 0], { radiusTop: 0.1, segments: 12 })
    b.cylinder("post", "post", "pole", 0.05, h + 0.85, [0, 0.1 + (h + 0.85) / 2, 0], { segments: 10 })
    // Head: housing box in front of the pole, visor per lamp.
    const z = 0.14
    b.span("head", "housing", "housing", [-0.15, h, z - 0.1], [0.15, h + 0.84, z + 0.1], { bevel: 0.03 })
    const ys = [h + 0.68, h + 0.42, h + 0.16]
    const names: Signal[] = ["red", "amber", "green"]
    ys.forEach((y, i) => {
      b.cylinder("head", "lens", `lens-${names[i]}`, 0.09, 0.02, [0, y, z + 0.105], { rot: [Math.PI / 2, 0, 0], segments: 16 })
      b.span("head", "housing", `visor-${i}`, [-0.12, y + 0.09, z + 0.1], [0.12, y + 0.115, z + 0.24])
      const lit = b.cylinder("lamps", names[i], `lit-${names[i]}`, 0.085, 0.02, [0, y, z + 0.125], { rot: [Math.PI / 2, 0, 0], segments: 16 })
      lit.userData.vibe3dRole = `signal.${names[i]}`
    })
    // Pedestrian lamp on the pole, facing the same way.
    b.span("head", "housing", "ped-box", [-0.1, 1.6, 0.05], [0.1, 1.85, 0.2], { bevel: 0.02 })
    const walk = b.span("lamps", "walk", "ped-lit", [-0.06, 1.65, 0.201], [0.06, 1.8, 0.21])
    walk.userData.vibe3dRole = "signal.walk"
  },
  sockets: () => ({}),
  actions: ({ parts }) => {
    let signal: Signal = "red"
    const apply = () => parts.lamps.anchor.traverse((o) => {
      const role = o.userData.vibe3dRole as string | undefined
      if (!role) return
      if (role === "signal.walk") (o as Mesh).visible = signal === "red"
      else (o as Mesh).visible = role === `signal.${signal}`
    })
    return {
      actions: {
        setSignal(s: Signal) { signal = s; apply() },
        get signal() { return signal },
      },
      update: apply,
    }
  },
}

export type TrafficLight = ModelInstance<TrafficLightConfig, Record<string, PartHandle<Group>>, TrafficLightActions>

export function createTrafficLight(kit: ShopKit, config: Partial<TrafficLightConfig> = {}, materials: Partial<Record<string, Material>> = {}): TrafficLight {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<TrafficLightConfig> = {}) {
  return createTrafficLight(kit, config)
}
