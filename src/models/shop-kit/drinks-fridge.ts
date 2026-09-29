/**
 * @shop-kit/drinks-fridge — upright glass-door drinks cooler with a lit interior, brand
 * header and bottles/cans on four shelves. `stock` (0..1) sets how many drinks are left.
 * Pivot: ground centre. The door faces +Z.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface DrinksFridgeConfig {
  width: number
  stock: number
  brand: "red" | "blue" | "green"
}

const DEPTH = 0.7
const HEIGHT = 2.0
const WALL = 0.04

export const drinksFridgeDefinition: ModelDefinition<DrinksFridgeConfig> = {
  id: "drinks-fridge",
  title: "Drinks Fridge",
  description: "Glass-door drinks cooler with a lit interior and stock-driven bottles.",
  categories: ["furniture", "retail", "appliance"],
  defaults: { width: 0.9, stock: 1, brand: "red" },
  fields: {
    width: { type: "number", min: 0.6, max: 1.8, step: 0.1, unit: "m", doc: "Cabinet width." },
    stock: { type: "number", min: 0, max: 1, step: 0.05, doc: "How full the shelves are." },
    brand: { type: "enum", options: ["red", "blue", "green"], doc: "Header panel colour." },
  },
  materialSlots: ["cabinet", "liner", "glass", "trim", "red", "blue", "green", "bottle", "can", "kick"],
  parts: ["cabinet", "door", "shelves", "drinks"],
  sockets: ["front"],
  actions: [],
  envelope: (c) => ({ width: c.width, depth: DEPTH, height: HEIGHT }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<DrinksFridgeConfig, Record<string, never>> = {
  definition: drinksFridgeDefinition,
  slotMap: {
    cabinet: "surface.awningLight", liner: "surface.fridgeLight", glass: "surface.fridgeGlass", trim: "hardware.steelDark",
    red: "prop.goodsA", blue: "prop.goodsC", green: "surface.paint", bottle: "prop.bottle", can: "hardware.steel", kick: "surface.rubber",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = DEPTH / 2
    const y0 = 0.1
    const top = HEIGHT - 0.28
    // Cabinet shell: back, sides, top and base around an open front.
    b.span("cabinet", "kick", "plinth", [-hw + 0.02, 0, -hd + 0.02], [hw - 0.02, y0, hd - 0.04])
    b.span("cabinet", "cabinet", "base", [-hw, y0, -hd], [hw, y0 + 0.08, hd])
    b.span("cabinet", "cabinet", "back", [-hw, y0 + 0.08, -hd], [hw, top, -hd + WALL])
    b.span("cabinet", "cabinet", "side-l", [-hw, y0 + 0.08, -hd + WALL], [-hw + WALL, top, hd])
    b.span("cabinet", "cabinet", "side-r", [hw - WALL, y0 + 0.08, -hd + WALL], [hw, top, hd])
    b.span("cabinet", c.brand, "header", [-hw, top, -hd], [hw, HEIGHT, hd + 0.02], { bevel: 0.02 })
    // Lit liner on the inside of the back wall.
    b.span("cabinet", "liner", "liner", [-hw + WALL, y0 + 0.08, -hd + WALL], [hw - WALL, top, -hd + WALL + 0.01])

    // Door: glass pane in a dark frame, 5 mm proud of the cabinet front, with a bar handle.
    const fz = hd
    b.span("door", "glass", "pane", [-hw + 0.05, y0 + 0.13, fz + 0.002], [hw - 0.05, top - 0.05, fz + 0.012])
    b.span("door", "trim", "frame-l", [-hw, y0 + 0.08, fz], [-hw + 0.05, top, fz + 0.03])
    b.span("door", "trim", "frame-r", [hw - 0.05, y0 + 0.08, fz], [hw, top, fz + 0.03])
    b.span("door", "trim", "frame-b", [-hw + 0.05, y0 + 0.08, fz], [hw - 0.05, y0 + 0.13, fz + 0.03])
    b.span("door", "trim", "frame-t", [-hw + 0.05, top - 0.05, fz], [hw - 0.05, top, fz + 0.03])
    b.span("door", "trim", "handle", [hw - 0.11, 0.8, fz + 0.03], [hw - 0.08, 1.3, fz + 0.07], { bevel: 0.01 })

    // Four wire shelves with drinks.
    const levels = 4
    const pitch = (top - y0 - 0.2) / levels
    const cols = Math.max(3, Math.floor((c.width - 0.12) / 0.11))
    const filled = Math.round(c.stock * cols)
    for (let l = 0; l < levels; l++) {
      const y = y0 + 0.12 + l * pitch
      b.span("shelves", "trim", `shelf-${l}`, [-hw + WALL + 0.001, y, -hd + WALL + 0.011], [hw - WALL - 0.001, y + 0.015, hd - 0.03])
      const bottles = l % 2 === 0
      for (let i = 0; i < filled; i++) {
        const x = -hw + 0.1 + i * ((c.width - 0.2) / Math.max(1, cols - 1))
        for (const z of [-0.1, 0.12]) {
          if (bottles) {
            b.cylinder("drinks", "bottle", `b-${l}-${i}-${z}`, 0.035, 0.24, [x, y + 0.015 + 0.12, z], { segments: 10 })
            b.cylinder("drinks", ["red", "blue", "green"][(i + l) % 3], `bc-${l}-${i}-${z}`, 0.02, 0.03, [x, y + 0.015 + 0.255, z], { segments: 8 })
          } else {
            b.cylinder("drinks", (i + l) % 2 ? "red" : "can", `c-${l}-${i}-${z}`, 0.033, 0.12, [x, y + 0.015 + 0.06, z], { segments: 12 })
          }
        }
      }
    }
  },
  sockets: () => ({ front: { kind: "nav.interact", at: [0, 0, DEPTH / 2 + 0.45] } }),
}

export type DrinksFridge = ModelInstance<DrinksFridgeConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createDrinksFridge(kit: ShopKit, config: Partial<DrinksFridgeConfig> = {}, materials: Partial<Record<string, Material>> = {}): DrinksFridge {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<DrinksFridgeConfig> = {}) {
  return createDrinksFridge(kit, config)
}
