/**
 * @shop-kit/playground — children's play corner: rubber safety pad with a kerb, a slide
 * tower (posts, deck, pointed roof, ladder, chute) and a swing set whose seats sway.
 * Pivot: ground centre. The slide stands on the -X half, the swings on the +X half.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface PlaygroundConfig {
  width: number
  depth: number
  swings: number
}

const PAD_TOP = 0.04
const BAR_Y = 2.1

export const playgroundDefinition: ModelDefinition<PlaygroundConfig> = {
  id: "playground",
  title: "Playground",
  description: "Rubber-padded play corner with a slide tower and a swing set.",
  categories: ["exterior", "park"],
  defaults: { width: 8, depth: 6, swings: 2 },
  fields: {
    width: { type: "number", min: 6, max: 14, step: 0.5, unit: "m", doc: "Pad length along X." },
    depth: { type: "number", min: 5, max: 10, step: 0.5, unit: "m", doc: "Pad depth along Z." },
    swings: { type: "integer", min: 1, max: 3, step: 1, unit: "count", doc: "Seats on the swing set." },
  },
  materialSlots: ["pad", "kerb", "post", "deck", "roof", "chute", "frame", "chain", "seat"],
  parts: ["ground", "slide", "swings"],
  sockets: ["entry"],
  actions: [],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: 2.6 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<PlaygroundConfig, Record<string, never>> = {
  definition: playgroundDefinition,
  slotMap: {
    pad: "surface.playMat", kerb: "surface.curb", post: "prop.goodsC", deck: "surface.wood", roof: "prop.goodsA",
    chute: "prop.goodsB", frame: "surface.paint", chain: "hardware.steel", seat: "surface.rubber",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    const k = 0.18
    b.span("ground", "pad", "pad", [-hw + k, -0.02, -hd + k], [hw - k, PAD_TOP, hd - k])
    b.span("ground", "kerb", "kerb-n", [-hw, -0.02, -hd], [hw, PAD_TOP + 0.05, -hd + k], { bevel: 0.01 })
    b.span("ground", "kerb", "kerb-s", [-hw, -0.02, hd - k], [hw, PAD_TOP + 0.05, hd], { bevel: 0.01 })
    b.span("ground", "kerb", "kerb-w", [-hw, -0.02, -hd + k], [-hw + k, PAD_TOP + 0.05, hd - k], { bevel: 0.01 })
    b.span("ground", "kerb", "kerb-e", [hw - k, -0.02, -hd + k], [hw, PAD_TOP + 0.05, hd - k], { bevel: 0.01 })

    // Slide tower: 1 m deck at 1.2 m on four posts, a pointed roof, ladder at the back
    // and a chute running down towards +Z.
    const tx = -hw + 1.7
    const tz = -hd + 1.6
    const deckY = 1.2
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.cylinder("slide", "post", `post-${sx}${sz}`, 0.06, 2.1, [tx + sx * 0.46, PAD_TOP + 1.05, tz + sz * 0.46], { segments: 10 })
    }
    b.span("slide", "deck", "deck", [tx - 0.5, deckY, tz - 0.5], [tx + 0.5, deckY + 0.06, tz + 0.5], { bevel: 0.01 })
    b.span("slide", "post", "guard-w", [tx - 0.53, deckY + 0.3, tz - 0.4], [tx - 0.49, deckY + 0.36, tz + 0.4])
    b.span("slide", "post", "guard-e", [tx + 0.49, deckY + 0.3, tz - 0.4], [tx + 0.53, deckY + 0.36, tz + 0.4])
    b.cylinder("slide", "roof", "roof", 0.82, 0.55, [tx, PAD_TOP + 2.1 + 0.275, tz], { radiusTop: 0.02, segments: 4, rot: [0, Math.PI / 4, 0] })
    // Ladder on the -Z side.
    const lz = tz - 0.5 - 0.35
    const ladderLen = Math.hypot(deckY, 0.35)
    const lTilt = Math.atan2(0.35, deckY)
    for (const s of [-1, 1]) {
      b.box("slide", "frame", `ladder-rail-${s}`, [0.05, ladderLen, 0.05], [tx + s * 0.24, PAD_TOP + deckY / 2, lz + 0.175], { rot: [lTilt, 0, 0] })
    }
    for (let i = 1; i <= 4; i++) {
      const f = i / 5
      b.cylinder("slide", "chain", `rung-${i}`, 0.018, 0.43, [tx, PAD_TOP + f * deckY, lz + f * 0.35], { rot: [0, 0, Math.PI / 2], segments: 8 })
    }
    // Chute from the front edge of the deck to the pad.
    const run = 2.1
    const drop = deckY - 0.25
    const cl = Math.hypot(run, drop)
    const tilt = Math.atan2(drop, run)
    const cz = tz + 0.5 + run / 2
    const cy = 0.25 + drop / 2 + PAD_TOP
    b.box("slide", "chute", "chute", [0.5, 0.04, cl], [tx, cy, cz], { rot: [tilt, 0, 0] })
    for (const s of [-1, 1]) {
      b.box("slide", "chute", `chute-side-${s}`, [0.04, 0.16, cl], [tx + s * 0.27, cy + 0.06, cz], { rot: [tilt, 0, 0] })
    }
    b.span("slide", "chute", "chute-lip", [tx - 0.29, PAD_TOP, cz + run / 2 - 0.02], [tx + 0.29, 0.25 + PAD_TOP, cz + run / 2 + 0.2], { bevel: 0.02 })

    // Swing set: A-frames at both ends of a top bar along X, seats hanging below.
    const x0 = 0.4
    const x1 = hw - 0.6
    const sz0 = 0
    const spread = 0.8
    const legLen = Math.hypot(BAR_Y, spread)
    const legTilt = Math.atan2(spread, BAR_Y)
    for (const x of [x0, x1]) {
      for (const s of [-1, 1]) {
        b.cylinder("swings", "frame", `leg-${x.toFixed(1)}-${s}`, 0.05, legLen, [x + s * 0.004, PAD_TOP + BAR_Y / 2, sz0 + s * spread / 2], {
          rot: [-s * legTilt, 0, 0], segments: 10,
        })
      }
    }
    b.cylinder("swings", "frame", "bar", 0.055, x1 - x0 + 0.2, [(x0 + x1) / 2, PAD_TOP + BAR_Y, sz0], { rot: [0, 0, Math.PI / 2], segments: 12 })
    const n = c.swings
    const pitch = (x1 - x0) / n
    const chainL = 1.62
    for (let i = 0; i < n; i++) {
      const x = x0 + pitch * (i + 0.5)
      const pivotY = PAD_TOP + BAR_Y - 0.03
      // Each swing mesh has its geometry hanging below its origin, which sits on the bar,
      // so rotating it about X swings the whole seat.
      for (const s of [-1, 1]) {
        const ch = b.cylinder("swings", "chain", `chain-${i}-${s}`, 0.012, chainL, [x + s * 0.22, pivotY, sz0], { segments: 6 })
        ch.geometry.translate(0, -chainL / 2, 0)
        ch.userData.vibe3dRole = "swing"
        ch.userData.swing = i
      }
      const seat = b.box("swings", "seat", `seat-${i}`, [0.5, 0.04, 0.2], [x, pivotY, sz0])
      seat.geometry.translate(0, -chainL - 0.02, 0)
      seat.userData.vibe3dRole = "swing"
      seat.userData.swing = i
    }
  },
  sockets: (c) => ({
    entry: { kind: "nav.enter", at: [0, 0, c.depth / 2 + 0.5] },
  }),
  actions: ({ parts }) => {
    let t = 0
    return {
      actions: {} as Record<string, never>,
      update(dt: number) {
        t += dt
        parts.swings.anchor.traverse((o) => {
          if (o.userData.vibe3dRole !== "swing") return
          const i = o.userData.swing as number
          o.rotation.x = Math.sin(t * 2.3 + i * 1.9) * (0.25 + 0.15 * ((i * 7) % 3))
        })
      },
    }
  },
}

export type Playground = ModelInstance<PlaygroundConfig, Record<string, PartHandle<Group>>, Record<string, never>>

export function createPlayground(kit: ShopKit, config: Partial<PlaygroundConfig> = {}, materials: Partial<Record<string, Material>> = {}): Playground {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<PlaygroundConfig> = {}) {
  return createPlayground(kit, config)
}
