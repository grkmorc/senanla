/**
 * @shop-kit/scrap-pile — heap of salvage on a dirt mound: tyres, crates, drums, bent panels
 * and pipes. `amount` (0..1) sets how much salvage is left; the heap shrinks as it's stripped.
 * Pivot: ground centre of the mound. The work spot faces +Z.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface ScrapPileConfig {
  radius: number
  amount: number
  variant: number
}

export const scrapPileDefinition: ModelDefinition<ScrapPileConfig> = {
  id: "scrap-pile",
  title: "Scrap Pile",
  description: "Salvage heap that shrinks as parts are stripped from it.",
  categories: ["props", "industrial", "junk"],
  defaults: { radius: 1.1, amount: 1, variant: 0 },
  fields: {
    radius: { type: "number", min: 0.5, max: 2.5, step: 0.1, unit: "m", doc: "Mound radius." },
    amount: { type: "number", min: 0, max: 1, step: 0.05, doc: "Salvage remaining." },
    variant: { type: "integer", min: 0, max: 99, step: 1, unit: "count", doc: "Layout seed." },
  },
  materialSlots: ["dirt", "rust", "rubber", "steel", "paint", "crate", "panel"],
  parts: ["mound", "junk"],
  sockets: ["work"],
  actions: [],
  envelope: (c) => ({ width: c.radius * 2, depth: c.radius * 2, height: 0.3 + c.amount * 1.1 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<ScrapPileConfig, Record<string, never>> = {
  definition: scrapPileDefinition,
  slotMap: {
    dirt: "surface.dirt",
    rust: "surface.rust",
    rubber: "surface.rubber",
    steel: "hardware.steel",
    paint: "surface.paint",
    crate: "prop.crate",
    panel: "prop.goodsC",
  },
  build(b, c) {
    const R = c.radius
    b.cylinder("mound", "dirt", "mound", R * 0.55, 0.219, [0, 0.1105, 0], { radiusTop: R * 0.4, segments: 20 })
    b.cylinder("mound", "dirt", "apron", R, 0.08, [0, 0.04, 0], { radiusTop: R * 0.6, segments: 20 })
    // Burn the variant into the PRNG so neighbouring piles differ.
    for (let i = 0; i < c.variant; i++) b.random()
    const count = Math.round(4 + c.amount * 14)
    const tiers = [0.22, 0.45, 0.68, 0.9]
    for (let i = 0; i < count; i++) {
      const tier = Math.min(tiers.length - 1, Math.floor((i / Math.max(1, count - 1)) * tiers.length * c.amount + 0.001))
      const spread = R * (0.75 - tier * 0.16)
      const a = b.random() * Math.PI * 2
      const d = Math.sqrt(b.random()) * spread
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      // Tiny per-item lift keeps resting faces from sharing a plane.
      const y = tiers[tier] - 0.03 + i * 0.0013
      const yaw = b.random() * Math.PI
      const kind = b.random()
      if (kind < 0.24) {
        // Tyre lying flat or leaning.
        const lean = b.random() < 0.5 ? 0 : 0.9 + b.random() * 0.5
        b.cylinder("junk", "rubber", `tyre-${i}`, 0.3, 0.2, [x, y + 0.1 + lean * 0.12, z], { rot: [lean, yaw, 0], segments: 18 })
        b.cylinder("junk", "steel", `rim-${i}`, 0.16, 0.205, [x, y + 0.1 + lean * 0.12, z], { rot: [lean, yaw, 0], segments: 12 })
      } else if (kind < 0.44) {
        const w = 0.3 + b.random() * 0.3
        b.box("junk", "crate", `crate-${i}`, [w, w * 0.75, w * 0.9], [x, y + w * 0.37, z], { rot: [0, yaw, (b.random() - 0.5) * 0.3], bevel: 0.01 })
      } else if (kind < 0.62) {
        b.cylinder("junk", b.random() < 0.5 ? "rust" : "paint", `drum-${i}`, 0.22, 0.6, [x, y + 0.22, z], { rot: [Math.PI / 2, yaw, 0], segments: 16 })
      } else if (kind < 0.84) {
        const l = 0.6 + b.random() * 0.6
        b.box("junk", b.random() < 0.5 ? "panel" : "rust", `panel-${i}`, [l, 0.03, 0.4 + b.random() * 0.3], [x, y + 0.12, z], { rot: [(b.random() - 0.5) * 0.9, yaw, (b.random() - 0.5) * 0.7] })
      } else {
        const l = 0.8 + b.random() * 0.7
        b.cylinder("junk", "steel", `pipe-${i}`, 0.04, l, [x, y + 0.08, z], { rot: [Math.PI / 2 + (b.random() - 0.5) * 0.5, yaw, 0.3], segments: 10 })
      }
    }
  },
  sockets: (c) => ({ work: { kind: "nav.interact", at: [0, 0, c.radius + 0.45] } }),
}

export type ScrapPile = ModelInstance<ScrapPileConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createScrapPile(kit: ShopKit, config: Partial<ScrapPileConfig> = {}, materials: Partial<Record<string, Material>> = {}): ScrapPile {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<ScrapPileConfig> = {}) {
  return createScrapPile(kit, config)
}
