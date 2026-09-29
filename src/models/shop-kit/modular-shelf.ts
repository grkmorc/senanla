/**
 * @shop-kit/modular-shelf — gondola shelving in 1 m bays.
 * Pivot: floor centre of the footprint. Shoppers stand on the +Z side.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface ModularShelfConfig {
  bays: number
  bayWidth: number
  depth: number
  height: number
  levels: number
  stock: number
  backPanel: boolean
}

const POST = 0.04
const BOARD_T = 0.025
const KICK_H = 0.1

export const modularShelfDefinition: ModelDefinition<ModularShelfConfig> = {
  id: "modular-shelf",
  title: "Modular Shelf",
  description: "Steel-post gondola shelf with wooden boards; bay count, levels and stock are configurable.",
  categories: ["furniture", "retail", "modular"],
  defaults: { bays: 2, bayWidth: 1, depth: 0.5, height: 1.8, levels: 4, stock: 0.8, backPanel: true },
  fields: {
    bays: { type: "integer", min: 1, max: 6, step: 1, unit: "count", doc: "Number of 1-module bays." },
    bayWidth: { type: "number", min: 0.5, max: 1.5, step: 0.25, unit: "m", doc: "Width of each bay (post centre to post centre)." },
    depth: { type: "number", min: 0.3, max: 0.9, step: 0.05, unit: "m", doc: "Shelf depth." },
    height: { type: "number", min: 0.8, max: 2.4, step: 0.1, unit: "m", doc: "Post height." },
    levels: { type: "integer", min: 2, max: 7, step: 1, unit: "count", doc: "Board count including the base board." },
    stock: { type: "number", min: 0, max: 1, step: 0.05, doc: "Fraction of board length filled with goods." },
    backPanel: { type: "boolean", doc: "Pegboard back panel." },
  },
  materialSlots: ["post", "board", "panel", "kick", "label", "goodsA", "goodsB", "goodsC", "crate"],
  parts: ["frame", "boards", "goods"],
  sockets: ["front"],
  actions: [],
  envelope: (c) => ({ width: c.bays * c.bayWidth + POST, depth: c.depth, height: c.height }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<ModularShelfConfig, Record<string, never>> = {
  definition: modularShelfDefinition,
  slotMap: {
    post: "hardware.steelDark",
    board: "surface.wood",
    panel: "surface.paint",
    kick: "surface.rubber",
    label: "signal.amber",
    goodsA: "prop.goodsA",
    goodsB: "prop.goodsB",
    goodsC: "prop.goodsC",
    crate: "prop.crate",
  },
  build(b, c) {
    const W = c.bays * c.bayWidth
    const hd = c.depth / 2
    const x0 = -W / 2

    // Posts at every bay line, front and back (outer faces define the envelope).
    for (let i = 0; i <= c.bays; i++) {
      const x = x0 + i * c.bayWidth
      for (const z of [hd - POST / 2, -hd + POST / 2]) {
        b.box("frame", "post", `post-${i}-${z > 0 ? "f" : "b"}`, [POST, c.height, POST], [x, c.height / 2, z], { bevel: 0.004 })
      }
      // Side brace between front and back posts, recessed so it never shares a post face.
      b.span("frame", "post", `brace-${i}`, [x - POST / 2 + 0.006, 0.05, -hd + POST], [x + POST / 2 - 0.006, 0.08, hd - POST])
      b.span("frame", "post", `brace-top-${i}`, [x - POST / 2 + 0.006, c.height - 0.08, -hd + POST], [x + POST / 2 - 0.006, c.height - 0.05, hd - POST])
    }

    // Back panel sits just inside the back posts' rear face.
    const panelBack = -hd + 0.006
    const panelFront = panelBack + 0.012
    if (c.backPanel) {
      b.span("frame", "panel", "pegboard", [x0 + POST / 2, KICK_H, panelBack], [x0 + W - POST / 2, c.height - 0.02, panelFront])
    }

    // Boards: between post inner faces, front edge 15 mm behind post front face.
    const boardFront = hd - 0.015
    const boardBack = c.backPanel ? panelFront : -hd + 0.015
    const usable = c.height - KICK_H - 0.12
    const pitch = usable / (c.levels - 1)
    for (let bay = 0; bay < c.bays; bay++) {
      const bx0 = x0 + bay * c.bayWidth + POST / 2
      const bx1 = bx0 + c.bayWidth - POST
      // Kick plate under the base board.
      b.span("boards", "kick", `kick-${bay}`, [bx0, 0, boardFront - 0.02], [bx1, KICK_H, boardFront - 0.005])
      for (let l = 0; l < c.levels; l++) {
        const y = KICK_H + l * pitch
        b.span("boards", "board", `board-${bay}-${l}`, [bx0, y, boardBack], [bx1, y + BOARD_T, boardFront], { bevel: 0.003 })
        // Price strip proud of the board nose.
        b.span("boards", "label", `price-${bay}-${l}`, [bx0 + 0.04, y - 0.012, boardFront], [bx0 + 0.16, y + BOARD_T - 0.004, boardFront + 0.006])

        // Goods: packed left-to-right until the stock fraction of this board is used.
        const clearH = l === c.levels - 1 ? 0.35 : pitch - BOARD_T - 0.04
        let cursor = bx0 + 0.03
        const limit = bx0 + (bx1 - bx0) * c.stock
        let n = 0
        while (cursor < limit - 0.06) {
          const kind = b.random()
          const w = 0.07 + b.random() * 0.14
          if (cursor + w > limit) break
          const h = Math.min(clearH, 0.1 + b.random() * 0.22)
          const d = Math.min(c.depth - 0.12, 0.12 + b.random() * 0.2)
          const zc = boardFront - 0.03 - d / 2
          const yb = y + BOARD_T
          if (kind < 0.35) {
            const slot = b.random() < 0.5 ? "goodsA" : "goodsC"
            b.span("goods", slot, `box-${bay}-${l}-${n}`, [cursor, yb, zc - d / 2], [cursor + w, yb + h, zc + d / 2], { bevel: 0.006 })
          } else if (kind < 0.7) {
            const r = Math.min(w, d) / 2
            const slot = b.random() < 0.5 ? "goodsB" : "goodsA"
            b.cylinder("goods", slot, `can-${bay}-${l}-${n}`, r * 0.9, h * 0.8, [cursor + r, yb + (h * 0.8) / 2, zc], { segments: 14 })
            cursor += r * 2 - w
          } else {
            b.span("goods", "crate", `crate-${bay}-${l}-${n}`, [cursor, yb, zc - d / 2], [cursor + w, yb + h * 0.7, zc + d / 2], { bevel: 0.004 })
          }
          cursor += w + 0.015 + b.random() * 0.02
          n++
        }
      }
    }
  },
  sockets: (c) => ({ front: { kind: "nav.interact", at: [0, 0, c.depth / 2 + 0.45] } }),
}

export type ModularShelf = ModelInstance<ModularShelfConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createModularShelf(kit: ShopKit, config: Partial<ModularShelfConfig> = {}, materials: Partial<Record<string, Material>> = {}): ModularShelf {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<ModularShelfConfig> = {}) {
  return createModularShelf(kit, config)
}
