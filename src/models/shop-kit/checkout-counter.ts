/**
 * @shop-kit/checkout-counter — front sales counter with overhanging top,
 * cash register (animated drawer), card terminal and a low impulse display.
 * Pivot: floor centre. Customers approach from +Z; the cashier stands at -Z.
 */
import type { Group, Material, Object3D } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface CheckoutCounterConfig {
  width: number
  depth: number
  height: number
  registerSide: "left" | "right"
}

export interface CheckoutCounterActions {
  /** Pop the cash drawer open, then close it automatically. */
  ring(): void
  readonly drawerOpen: number
}

const KICK_H = 0.1
const TOP_T = 0.04
const DRAWER_TRAVEL = 0.16

export const checkoutCounterDefinition: ModelDefinition<CheckoutCounterConfig> = {
  id: "checkout-counter",
  title: "Checkout Counter",
  description: "Panelled front counter with register, card terminal and impulse-buy rack.",
  categories: ["furniture", "retail"],
  defaults: { width: 2.2, depth: 0.7, height: 1.0, registerSide: "right" },
  fields: {
    width: { type: "number", min: 1.2, max: 4, step: 0.1, unit: "m", doc: "Counter width." },
    depth: { type: "number", min: 0.5, max: 1, step: 0.05, unit: "m", doc: "Counter depth including top overhang." },
    height: { type: "number", min: 0.8, max: 1.15, step: 0.05, unit: "m", doc: "Counter top height." },
    registerSide: { type: "enum", options: ["left", "right"], doc: "Register position seen from the customer side." },
  },
  materialSlots: ["body", "panel", "kick", "top", "trim", "register", "screen", "drawer", "goodsA", "goodsB"],
  parts: ["body", "top", "register", "display"],
  sockets: ["cashier", "customer"],
  actions: ["ring"],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: c.height + 0.45 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<CheckoutCounterConfig, CheckoutCounterActions> = {
  definition: checkoutCounterDefinition,
  slotMap: {
    body: "surface.woodDark",
    panel: "surface.paint",
    kick: "surface.rubber",
    top: "surface.counterTop",
    trim: "hardware.steel",
    register: "hardware.steelDark",
    screen: "signal.cyan",
    drawer: "hardware.steel",
    goodsA: "prop.goodsA",
    goodsB: "prop.goodsB",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    const topY = c.height - TOP_T
    // Carcass is inset: 40 mm overhang to the front, 30 mm at the sides.
    const bx = hw - 0.03
    const bzf = hd - 0.04
    const bzb = -hd + 0.02

    b.span("body", "kick", "kick", [-bx + 0.02, 0, bzb + 0.02], [bx - 0.02, KICK_H, bzf - 0.03])
    b.span("body", "body", "carcass", [-bx, KICK_H, bzb], [bx, topY, bzf], { bevel: 0.006 })

    // Customer-side raised panels, 12 mm proud of the carcass front.
    const panels = Math.max(2, Math.round(c.width / 0.7))
    const pw = (2 * bx - 0.08) / panels
    for (let i = 0; i < panels; i++) {
      const x0 = -bx + 0.04 + i * pw
      b.span("body", "panel", `panel-${i}`, [x0 + 0.03, KICK_H + 0.08, bzf], [x0 + pw - 0.03, topY - 0.08, bzf + 0.012], { bevel: 0.004 })
    }
    // Cashier-side open shelf niche: a darker recess board.
    b.span("body", "kick", "niche", [-bx + 0.06, KICK_H + 0.3, bzb - 0.01], [bx - 0.06, topY - 0.12, bzb + 0.002])

    // Top with steel nosing on the customer edge.
    b.span("top", "top", "countertop", [-hw, topY, -hd], [hw, c.height, hd - 0.012], { bevel: 0.006 })
    b.span("top", "trim", "nosing", [-hw, topY - 0.01, hd - 0.012], [hw, c.height + 0.004, hd], { bevel: 0.003 })

    // Register (cashier-facing screen) — "right" is from the customer's view (+Z looking -Z => -X).
    const s = c.registerSide === "right" ? -1 : 1
    const rx = s * (hw - 0.35)
    const y = c.height
    b.span("register", "register", "register-base", [rx - 0.2, y, -0.2], [rx + 0.2, y + 0.1, 0.18], { bevel: 0.01 })
    const drawer = b.span("register", "drawer", "cash-drawer", [rx - 0.17, y + 0.012, -0.215], [rx + 0.17, y + 0.075, -0.195], { bevel: 0.004 })
    drawer.userData.vibe3dRole = "register.drawer"
    drawer.userData.closedZ = drawer.position.z
    b.span("register", "register", "keypad", [rx - 0.16, y + 0.1, -0.16], [rx + 0.06, y + 0.13, 0.02], { rot: [0, 0, 0] })
    b.cylinder("register", "register", "screen-post", 0.018, 0.16, [rx + 0.12, y + 0.18, -0.02])
    b.box("register", "register", "screen-housing", [0.2, 0.14, 0.03], [rx + 0.12, y + 0.29, -0.02], { rot: [-0.35, 0, 0], bevel: 0.006 })
    // Screen glass 1.5 mm proud of the housing's cashier face, sharing its tilt.
    const tilt = -0.35
    const off = -(0.015 + 0.0045)
    b.box("register", "screen", "screen", [0.17, 0.11, 0.006],
      [rx + 0.12, y + 0.29 - off * Math.sin(tilt), -0.02 + off * Math.cos(tilt)], { rot: [tilt, 0, 0] })
    // Card terminal facing the customer.
    b.box("register", "register", "card-terminal", [0.08, 0.035, 0.15], [-rx * 0.35, y + 0.0175, 0.12], { bevel: 0.008 })
    b.box("register", "screen", "terminal-screen", [0.06, 0.004, 0.05], [-rx * 0.35, y + 0.037, 0.15])

    // Impulse display: small wire rack with candy boxes on the far end.
    const dx = -s * (hw - 0.25)
    b.span("display", "trim", "rack-base", [dx - 0.15, y, 0.02], [dx + 0.15, y + 0.012, 0.26])
    b.span("display", "trim", "rack-back", [dx - 0.15, y + 0.012, 0.02], [dx + 0.15, y + 0.2, 0.032])
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 4; i++) {
        const x0 = dx - 0.14 + i * 0.07
        const z0 = 0.04 + r * 0.11
        const h = 0.06 + b.random() * 0.08
        b.span("display", (i + r) % 2 ? "goodsA" : "goodsB", `candy-${r}-${i}`, [x0 + 0.005, y + 0.012, z0], [x0 + 0.062, y + 0.012 + h, z0 + 0.09], { bevel: 0.005 })
      }
    }
  },
  sockets: (c) => ({
    cashier: { kind: "nav.interact", at: [0, 0, -c.depth / 2 - 0.45] },
    customer: { kind: "nav.interact", at: [0, 0, c.depth / 2 + 0.45] },
  }),
  actions: ({ parts }) => {
    let t = 0 // 0..1 open amount
    let phase: "idle" | "opening" | "hold" | "closing" = "idle"
    let hold = 0
    const drawer = (): Object3D | undefined => {
      let found: Object3D | undefined
      parts.register.anchor.traverse((o) => { if (o.userData.vibe3dRole === "register.drawer") found = o })
      return found
    }
    return {
      actions: {
        ring() { if (phase === "idle" || phase === "closing") phase = "opening" },
        get drawerOpen() { return t },
      },
      update(dt) {
        if (phase === "opening") { t = Math.min(1, t + dt * 5); if (t === 1) { phase = "hold"; hold = 1.2 } }
        else if (phase === "hold") { hold -= dt; if (hold <= 0) phase = "closing" }
        else if (phase === "closing") { t = Math.max(0, t - dt * 2.5); if (t === 0) phase = "idle" }
        const d = drawer()
        if (d) d.position.z = d.userData.closedZ - DRAWER_TRAVEL * t
      },
    }
  },
}

export type CheckoutCounter = ModelInstance<CheckoutCounterConfig, Record<string, PartHandle<Group>>, CheckoutCounterActions>

export function createCheckoutCounter(kit: ShopKit, config: Partial<CheckoutCounterConfig> = {}, materials: Partial<Record<string, Material>> = {}): CheckoutCounter {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<CheckoutCounterConfig> = {}) {
  return createCheckoutCounter(kit, config)
}
