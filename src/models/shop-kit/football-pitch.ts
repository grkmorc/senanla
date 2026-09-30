/**
 * @shop-kit/football-pitch — neighbourhood five-a-side pitch: mown-stripe turf, white
 * markings (touchlines, halfway line, centre circle, penalty boxes), two netted goals, a low
 * mesh fence with a gate on the +Z side and optional floodlights on the corners.
 * Pivot: ground centre. The long axis runs along X; goals sit at ±X.
 */
import type { Group, Material } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface FootballPitchConfig {
  width: number
  depth: number
  fence: boolean
  floodlights: boolean
}

export interface FootballPitchActions {
  /** Switch the floodlight heads on or off. */
  setLights(on: boolean): void
}

const TURF_TOP = 0.02
const STRIPE_TOP = 0.028
const LINE_TOP = 0.034
const LW = 0.08 // line width
const RUNOFF = 1.1
const FENCE_H = 1.1

export const footballPitchDefinition: ModelDefinition<FootballPitchConfig> = {
  id: "football-pitch",
  title: "Football Pitch",
  description: "Fenced five-a-side pitch with striped turf, markings, goals and floodlights.",
  categories: ["exterior", "sport", "park"],
  defaults: { width: 18, depth: 11, fence: true, floodlights: true },
  fields: {
    width: { type: "number", min: 12, max: 40, step: 0.5, unit: "m", doc: "Overall length along X, including the run-off." },
    depth: { type: "number", min: 8, max: 26, step: 0.5, unit: "m", doc: "Overall width along Z, including the run-off." },
    fence: { type: "boolean", doc: "Low mesh fence around the pitch with a gate on the +Z side." },
    floodlights: { type: "boolean", doc: "Light masts on the four corners." },
  },
  materialSlots: ["turf", "turfAlt", "line", "post", "net", "fence", "mast", "lamp"],
  parts: ["ground", "markings", "goals", "fence", "lights"],
  sockets: ["centre", "gate", "goalWest", "goalEast"],
  actions: ["setLights"],
  envelope: (c) => ({ width: c.width + 0.2, depth: c.depth + 0.2, height: c.floodlights ? 6.6 : 2.3 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<FootballPitchConfig, FootballPitchActions> = {
  definition: footballPitchDefinition,
  slotMap: {
    turf: "surface.turf", turfAlt: "surface.turfAlt", line: "signal.paint", post: "surface.awningLight",
    net: "prop.net", fence: "hardware.steelDark", mast: "hardware.steel", lamp: "signal.warm",
  },
  build(b, c) {
    const W = c.width / 2
    const D = c.depth / 2
    // Turf slab sunk slightly into the ground, then mown stripes across the length.
    b.span("ground", "turfAlt", "turf", [-W, -0.03, -D], [W, TURF_TOP, D])
    const n = Math.max(6, Math.round(c.width / 1.6))
    const sw = c.width / n
    for (let i = 0; i < n; i += 2) {
      b.span("ground", "turf", `stripe-${i}`, [-W + i * sw, TURF_TOP, -D + 0.05], [-W + (i + 1) * sw, STRIPE_TOP, D - 0.05])
    }

    // Markings: field is the turf minus the run-off.
    const hl = W - RUNOFF
    const hw = D - RUNOFF
    const h = LW / 2
    const line = (label: string, x0: number, z0: number, x1: number, z1: number) =>
      b.span("markings", "line", label, [x0, STRIPE_TOP, z0], [x1, LINE_TOP, z1])
    line("touch-n", -hl - h, -hw - h, hl + h, -hw + h)
    line("touch-s", -hl - h, hw - h, hl + h, hw + h)
    line("goal-w", -hl - h, -hw + h, -hl + h, hw - h)
    line("goal-e", hl - h, -hw + h, hl + h, hw - h)
    line("halfway", -h, -hw + h, h, hw - h)
    const cr = Math.min(1.8, hw * 0.45)
    b.torus("markings", "line", "centre-circle", cr, h, [0, STRIPE_TOP - 0.03, 0], { segments: 40 })
    b.cylinder("markings", "line", "centre-spot", 0.12, 0.012, [0, STRIPE_TOP + 0.006 + 0.002, 0], { segments: 16 })
    const bd = Math.min(3, hl * 0.3) // penalty box depth
    const bw = Math.min(3.2, hw * 0.7) // half width
    for (const s of [-1, 1]) {
      const gx = s * hl
      const fx = s * (hl - bd)
      line(`box-front-${s}`, Math.min(fx - h, fx + h), -bw - h, Math.max(fx - h, fx + h), bw + h)
      const xa = Math.min(fx, gx) + h
      const xb = Math.max(fx, gx) - h
      line(`box-n-${s}`, xa, -bw - h, xb, -bw + h)
      line(`box-s-${s}`, xa, bw - h, xb, bw + h)
      b.cylinder("markings", "line", `pen-spot-${s}`, 0.09, 0.012, [s * (hl - bd * 0.7), STRIPE_TOP + 0.006, 0], { segments: 12 })
    }

    // Goals: white posts on the goal line, nets running back into the run-off.
    const gw = Math.min(1.6, hw * 0.4) // half the mouth
    const gh = 2
    const gd = 0.9
    for (const s of [-1, 1]) {
      const x = s * (hl + h + 0.05)
      const xb = s * (hl + h + 0.05 + gd)
      for (const z of [-gw, gw]) {
        b.cylinder("goals", "post", `post-${s}-${z > 0 ? "s" : "n"}`, 0.05, gh, [x, gh / 2 + 0.002, z], { segments: 10 })
        b.cylinder("goals", "post", `back-${s}-${z > 0 ? "s" : "n"}`, 0.03, gh * 0.6, [xb, gh * 0.3 + 0.002, z], { segments: 8 })
        b.cylinder("goals", "post", `stay-${s}-${z > 0 ? "s" : "n"}`, 0.025, Math.hypot(gd, gh * 0.4) , [(x + xb) / 2, gh * 0.8, z], {
          rot: [0, 0, s * Math.atan2(gd, gh * 0.4)], segments: 8,
        })
      }
      b.cylinder("goals", "post", `bar-${s}`, 0.045, gw * 2 - 0.02, [x, gh, 0], { rot: [Math.PI / 2, 0, 0], segments: 10 })
      b.cylinder("goals", "post", `ground-bar-${s}`, 0.03, gw * 2, [xb, 0.03, 0], { rot: [Math.PI / 2, 0, 0], segments: 8 })
      const n0 = Math.min(x, xb)
      const n1 = Math.max(x, xb)
      b.span("goals", "net", `net-back-${s}`, [s > 0 ? n1 - 0.02 : n0, 0.03, -gw + 0.02], [s > 0 ? n1 : n0 + 0.02, gh * 0.6, gw - 0.02])
      b.box("goals", "net", `net-top-${s}`, [Math.hypot(gd, gh * 0.4) - 0.08, 0.01, gw * 2 - 0.04], [(x + xb) / 2, gh * 0.8 - 0.02, 0], {
        rot: [0, 0, -s * Math.atan2(gh * 0.4, gd)],
      })
      for (const z of [-gw, gw]) {
        b.span("goals", "net", `net-side-${s}-${z > 0 ? "s" : "n"}`, [n0 + 0.05, 0.03, z - 0.006], [n1 - 0.04, gh * 0.6, z + 0.006])
      }
    }

    // Fence: posts every ~2.5 m, a top rail and see-through mesh; a gate gap on +Z.
    if (c.fence) {
      const fx = W - 0.08
      const fz = D - 0.08
      const gate = 1.2
      const posts: [number, number][] = []
      const nx = Math.max(2, Math.round((fx * 2) / 2.5))
      for (let i = 0; i <= nx; i++) {
        const x = -fx + (i * 2 * fx) / nx
        posts.push([x, -fz])
        if (Math.abs(x) > gate + 0.05) posts.push([x, fz])
      }
      posts.push([-gate, fz], [gate, fz])
      const nz = Math.max(2, Math.round((fz * 2) / 2.5))
      for (let j = 1; j < nz; j++) {
        const z = -fz + (j * 2 * fz) / nz
        posts.push([-fx, z], [fx, z])
      }
      posts.forEach(([x, z], i) => b.cylinder("fence", "fence", `fpost-${i}`, 0.035, FENCE_H, [x, FENCE_H / 2, z], { segments: 8 }))
      const rail = (label: string, x0: number, z0: number, x1: number, z1: number) => {
        const len = Math.hypot(x1 - x0, z1 - z0)
        const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
        b.cylinder("fence", "fence", label, 0.022, len, [(x0 + x1) / 2, FENCE_H - 0.02, (z0 + z1) / 2], {
          rot: alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], segments: 8,
        })
      }
      rail("rail-n", -fx, -fz, fx, -fz)
      rail("rail-w", -fx, -fz, -fx, fz)
      rail("rail-e", fx, -fz, fx, fz)
      rail("rail-sw", -fx, fz, -gate, fz)
      rail("rail-se", gate, fz, fx, fz)
      const mesh = (label: string, min: [number, number, number], max: [number, number, number]) => b.span("fence", "net", label, min, max)
      const t = 0.006
      mesh("mesh-n", [-fx + 0.04, 0.05, -fz - t], [fx - 0.04, FENCE_H - 0.06, -fz + t])
      mesh("mesh-w", [-fx - t, 0.05, -fz + 0.04], [-fx + t, FENCE_H - 0.06, fz - 0.04])
      mesh("mesh-e", [fx - t, 0.05, -fz + 0.04], [fx + t, FENCE_H - 0.06, fz - 0.04])
      mesh("mesh-sw", [-fx + 0.04, 0.05, fz - t], [-gate - 0.04, FENCE_H - 0.06, fz + t])
      mesh("mesh-se", [gate + 0.04, 0.05, fz - t], [fx - 0.04, FENCE_H - 0.06, fz + t])
    }

    // Floodlight masts on the corners, heads leaning in over the pitch.
    if (c.floodlights) {
      const mh = 6
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * (W - 0.3)
        const z = sz * (D - 0.3)
        b.cylinder("lights", "mast", `mast-${sx}${sz}`, 0.07, mh, [x, mh / 2, z], { radiusTop: 0.05, segments: 10 })
        // Head faces the pitch centre; the lens sits on its inner face.
        const a = Math.atan2(sx, sz)
        b.box("lights", "fence", `head-${sx}${sz}`, [0.8, 0.28, 0.1], [x, mh + 0.15, z], { rot: [0, a, 0], bevel: 0.02 })
        const lens = b.box("lights", "lamp", `lens-${sx}${sz}`, [0.7, 0.2, 0.02], [x - sx * 0.044, mh + 0.15, z - sz * 0.044], { rot: [0, a, 0] })
        lens.userData.vibe3dRole = "pitch.lamp"
      }
    }
  },
  sockets: (c) => ({
    centre: { kind: "play.area", at: [0, LINE_TOP, 0] },
    gate: { kind: "nav.enter", at: [0, 0, c.depth / 2 + 0.6] },
    goalWest: { kind: "play.goal", at: [-(c.width / 2 - RUNOFF), 0, 0] },
    goalEast: { kind: "play.goal", at: [c.width / 2 - RUNOFF, 0, 0] },
  }),
  actions: ({ parts }) => ({
    actions: {
      setLights(on: boolean) {
        parts.lights.anchor.traverse((o) => {
          if (o.userData.vibe3dRole === "pitch.lamp") o.visible = on
        })
      },
    },
  }),
}

export type FootballPitch = ModelInstance<FootballPitchConfig, Record<string, PartHandle<Group>>, FootballPitchActions>

export function createFootballPitch(kit: ShopKit, config: Partial<FootballPitchConfig> = {}, materials: Partial<Record<string, Material>> = {}): FootballPitch {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<FootballPitchConfig> = {}) {
  return createFootballPitch(kit, config)
}
