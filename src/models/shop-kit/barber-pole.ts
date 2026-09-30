/**
 * @shop-kit/barber-pole — wall-mounted barber's pole: chrome caps, a glass sleeve and a
 * white core wrapped by red and blue helix stripes that spin (`update`).
 * Pivot: the wall face at the bracket; the pole stands out along +Z.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface BarberPoleConfig {
  height: number
  /** Spin speed in turns per second (0 = still). */
  spin: number
}

const OUT = 0.22 // pole axis distance from the wall

export const barberPoleDefinition: ModelDefinition<BarberPoleConfig> = {
  id: "barber-pole",
  title: "Barber Pole",
  description: "Spinning red-white-blue barber's pole on a wall bracket.",
  categories: ["exterior", "signage"],
  defaults: { height: 0.8, spin: 0.35 },
  fields: {
    height: { type: "number", min: 0.5, max: 1.4, step: 0.05, unit: "m", doc: "Sleeve height." },
    spin: { type: "number", min: 0, max: 1.5, step: 0.05, doc: "Stripe rotation, turns per second." },
  },
  materialSlots: ["chrome", "core", "red", "blue", "glass"],
  parts: ["bracket", "stripes"],
  sockets: [],
  actions: [],
  envelope: (c) => ({ width: 0.24, depth: OUT + 0.12, height: c.height + 0.3 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<BarberPoleConfig, Record<string, never>> = {
  definition: barberPoleDefinition,
  slotMap: { chrome: "hardware.steel", core: "signal.paint", red: "prop.goodsA", blue: "prop.goodsC", glass: "surface.fridgeGlass" },
  build(b, c) {
    const h = c.height
    b.span("bracket", "chrome", "plate", [-0.08, -0.12, 0], [0.08, h + 0.12, 0.02], { bevel: 0.008 })
    for (const y of [-0.06, h + 0.06]) b.span("bracket", "chrome", `arm-${y > 0 ? "t" : "b"}`, [-0.02, y - 0.02, 0.02], [0.02, y + 0.02, OUT])
    b.cylinder("bracket", "chrome", "cap-b", 0.075, 0.1, [0, -0.05, OUT], { radiusTop: 0.085, segments: 16 })
    b.cylinder("bracket", "chrome", "cap-t", 0.085, 0.1, [0, h + 0.05, OUT], { radiusTop: 0.06, segments: 16 })
    b.cylinder("bracket", "chrome", "finial", 0.035, 0.08, [0, h + 0.14, OUT], { segments: 10 })
    b.cylinder("bracket", "glass", "sleeve", 0.08, h, [0, h / 2, OUT], { segments: 20 })
    // Core and stripes live in the "stripes" part, centred on the axis so it can spin.
    b.cylinder("stripes", "core", "core", 0.06, h - 0.01, [0, h / 2, 0], { segments: 16 })
    const turns = 2.2
    const steps = Math.round(h * 40)
    for (const [slot, off] of [["red", 0], ["blue", Math.PI]] as const) {
      for (let i = 0; i < steps; i++) {
        const f = (i + 0.5) / steps
        const a = off + f * turns * Math.PI * 2
        b.box("stripes", slot, `${slot}-${i}`, [0.05, h / steps + 0.004, 0.012], [Math.sin(a) * 0.062, f * h, Math.cos(a) * 0.062], { rot: [0, a, 0.5] })
      }
    }
  },
  sockets: () => ({}),
  actions: ({ parts, config }) => {
    // The stripes part pivots on the pole axis.
    parts.stripes.anchor.position.set(0, 0, OUT)
    return {
      actions: {} as Record<string, never>,
      update(dt: number) {
        parts.stripes.anchor.rotation.y += dt * config().spin * Math.PI * 2
      },
    }
  },
}

export type BarberPole = ModelInstance<BarberPoleConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createBarberPole(kit: ShopKit, config: Partial<BarberPoleConfig> = {}, materials: Partial<Record<string, Material>> = {}): BarberPole {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<BarberPoleConfig> = {}) {
  return createBarberPole(kit, config)
}
