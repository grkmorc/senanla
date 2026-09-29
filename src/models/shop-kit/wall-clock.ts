/**
 * @shop-kit/wall-clock — round wall clock with bezel, hour ticks and animated hands.
 * Pivot: clock centre on the wall surface; the face points +Z. Hands rotate their
 * stable part anchors, so a rebuild never resets the displayed time.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface WallClockConfig {
  radius: number
  depth: number
}

export interface WallClockActions {
  /** Set the displayed time; hands ease towards it in update(). */
  setTime(hours: number, minutes: number): void
}

export const wallClockDefinition: ModelDefinition<WallClockConfig> = {
  id: "wall-clock",
  title: "Wall Clock",
  description: "Round wall clock whose hands show any time you give it.",
  categories: ["decor", "wall"],
  defaults: { radius: 0.22, depth: 0.05 },
  fields: {
    radius: { type: "number", min: 0.1, max: 0.6, step: 0.01, unit: "m", doc: "Bezel radius." },
    depth: { type: "number", min: 0.03, max: 0.12, step: 0.005, unit: "m", doc: "Case depth off the wall." },
  },
  materialSlots: ["case", "face", "hand", "second"],
  parts: ["case", "face", "hourHand", "minuteHand"],
  sockets: [],
  actions: ["setTime"],
  envelope: (c) => ({ width: c.radius * 2, depth: c.depth, height: c.radius * 2 }),
  capabilities: ["webgl"],
}

const FACE_ROT: [number, number, number] = [Math.PI / 2, 0, 0]

const spec: ShopModelSpec<WallClockConfig, WallClockActions> = {
  definition: wallClockDefinition,
  slotMap: { case: "hardware.steelDark", face: "surface.clockFace", hand: "surface.rubber", second: "prop.goodsA" },
  build(b, c) {
    const r = c.radius
    const d = c.depth
    // Case: back plate + bezel ring (a slightly larger disc behind the recessed face).
    b.cylinder("case", "case", "case", r, d, [0, 0, d / 2], { rot: FACE_ROT, segments: 40 })
    b.cylinder("face", "face", "dial", r * 0.88, 0.006, [0, 0, d + 0.001], { rot: FACE_ROT, segments: 40 })
    const faceZ = d + 0.004
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const major = i % 3 === 0
      const len = major ? r * 0.14 : r * 0.08
      const rr = r * 0.74
      b.box("face", "hand", `tick-${i}`, [major ? 0.012 : 0.006, len, 0.003],
        [Math.sin(a) * rr, Math.cos(a) * rr, faceZ + 0.0015], { rot: [0, 0, -a] })
    }
    // Hands point to 12 o'clock in local space; their part anchors rotate about Z.
    b.box("hourHand", "hand", "hour", [0.016, r * 0.5, 0.004], [0, r * 0.2, faceZ + 0.006])
    b.box("minuteHand", "hand", "minute", [0.01, r * 0.72, 0.004], [0, r * 0.3, faceZ + 0.011])
    b.cylinder("minuteHand", "second", "hub", 0.014, 0.006, [0, 0, faceZ + 0.016], { rot: FACE_ROT, segments: 16 })
  },
  sockets: () => ({}),
  actions: ({ parts }) => {
    let target = 0 // minutes past 12:00
    let shown = 0
    const place = () => {
      parts.minuteHand.anchor.rotation.z = -((shown % 60) / 60) * Math.PI * 2
      parts.hourHand.anchor.rotation.z = -((shown % 720) / 720) * Math.PI * 2
    }
    return {
      actions: {
        setTime(h: number, m: number) {
          const next = ((h % 12) * 60 + m) % 720
          // Always move forwards; wrap across 12 o'clock.
          target = next + Math.floor(shown / 720) * 720
          if (target < shown - 1) target += 720
        },
      },
      update(dt: number) {
        shown += (target - shown) * (1 - Math.exp(-dt * 6))
        if (Math.abs(target - shown) < 0.01) shown = target
        if (shown > 720 * 50) { shown -= 720 * 49; target -= 720 * 49 }
        place()
      },
    }
  },
}

export type WallClock = ModelInstance<WallClockConfig, Record<string, PartHandle<Group>>, WallClockActions>

export function createWallClock(kit: ShopKit, config: Partial<WallClockConfig> = {}, materials: Partial<Record<string, Material>> = {}): WallClock {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<WallClockConfig> = {}) {
  return createWallClock(kit, config)
}
