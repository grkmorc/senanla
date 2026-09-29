/**
 * @shop-kit/car — compact city car: lower body, glazed cabin, bumpers, head/tail lamps
 * and four wheels that spin with speed. Styles change proportions (sedan, hatch, van, taxi).
 * Pivot: ground centre between the axles. Forward is +Z.
 */
import type { Group, Material, Mesh } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export type CarPaint = "red" | "blue" | "white" | "black" | "yellow" | "teal" | "silver"

export interface CarConfig {
  style: "sedan" | "hatch" | "van" | "taxi"
  paint: CarPaint
}

export interface CarActions {
  /** Road speed in m/s; drives the wheel spin. */
  setSpeed(v: number): void
  setBrake(on: boolean): void
}

interface Dims { len: number; wid: number; body: number; cabinLen: number; cabinH: number; cabinOff: number; wheelR: number }

const DIMS: Record<CarConfig["style"], Dims> = {
  sedan: { len: 4.3, wid: 1.8, body: 0.62, cabinLen: 2.2, cabinH: 0.5, cabinOff: -0.15, wheelR: 0.33 },
  taxi: { len: 4.3, wid: 1.8, body: 0.62, cabinLen: 2.2, cabinH: 0.5, cabinOff: -0.15, wheelR: 0.33 },
  hatch: { len: 3.7, wid: 1.72, body: 0.6, cabinLen: 2.1, cabinH: 0.55, cabinOff: -0.4, wheelR: 0.31 },
  van: { len: 4.8, wid: 1.95, body: 0.75, cabinLen: 3.7, cabinH: 1.0, cabinOff: -0.45, wheelR: 0.34 },
}

export const carDefinition: ModelDefinition<CarConfig> = {
  id: "car",
  title: "City Car",
  description: "Stylised city car with spinning wheels, brake lights and four body styles.",
  categories: ["vehicle", "props", "street"],
  defaults: { style: "sedan", paint: "red" },
  fields: {
    style: { type: "enum", options: ["sedan", "hatch", "van", "taxi"], doc: "Body style." },
    paint: { type: "enum", options: ["red", "blue", "white", "black", "yellow", "teal", "silver"], doc: "Body colour (taxi is always yellow)." },
  },
  materialSlots: ["red", "blue", "white", "black", "yellow", "teal", "silver", "glass", "trim", "tyre", "hub", "head", "tail", "sign"],
  parts: ["body", "cabin", "lamps", "wheels"],
  sockets: [],
  actions: ["setSpeed", "setBrake"],
  envelope: (c) => ({ width: DIMS[c.style].wid, depth: DIMS[c.style].len, height: DIMS[c.style].body + DIMS[c.style].cabinH + 0.3 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<CarConfig, CarActions> = {
  definition: carDefinition,
  slotMap: {
    red: "prop.goodsA", blue: "prop.goodsC", white: "surface.awningLight", black: "surface.roof",
    yellow: "prop.goodsB", teal: "surface.paint", silver: "hardware.steel",
    glass: "surface.carGlass", trim: "hardware.steelDark", tyre: "surface.rubber", hub: "hardware.steel",
    head: "signal.warm", tail: "signal.red", sign: "surface.awningLight",
  },
  build(b, c) {
    const d = DIMS[c.style]
    const paint = c.style === "taxi" ? "yellow" : c.paint
    const hl = d.len / 2
    const hw = d.wid / 2
    const clear = 0.22
    const bodyTop = clear + d.body

    // Lower body with a softer beltline, bumpers proud front and back.
    b.span("body", paint, "body", [-hw, clear, -hl + 0.12], [hw, bodyTop, hl - 0.12], { bevel: 0.1 })
    b.span("body", "trim", "bumper-f", [-hw + 0.05, clear - 0.02, hl - 0.2], [hw - 0.05, clear + 0.2, hl], { bevel: 0.05 })
    b.span("body", "trim", "bumper-r", [-hw + 0.05, clear - 0.02, -hl], [hw - 0.05, clear + 0.2, -hl + 0.2], { bevel: 0.05 })
    b.span("body", "trim", "sill-l", [-hw - 0.012, clear + 0.02, -hl + d.wheelR * 2 + 0.2], [-hw + 0.1, clear + 0.12, hl - d.wheelR * 2 - 0.2])
    b.span("body", "trim", "sill-r", [hw - 0.1, clear + 0.02, -hl + d.wheelR * 2 + 0.2], [hw + 0.012, clear + 0.12, hl - d.wheelR * 2 - 0.2])

    // Cabin: glass box with a painted roof and pillars.
    const c0 = d.cabinOff - d.cabinLen / 2
    const c1 = d.cabinOff + d.cabinLen / 2
    const ch = bodyTop + d.cabinH
    b.span("cabin", "glass", "glasshouse", [-hw + 0.1, bodyTop - 0.02, c0 + 0.08], [hw - 0.1, ch - 0.05, c1 - 0.08], { bevel: 0.08 })
    b.span("cabin", paint, "roof", [-hw + 0.12, ch - 0.07, c0 + 0.18], [hw - 0.12, ch, c1 - 0.18], { bevel: 0.03 })
    for (const s of [-1, 1]) {
      b.span("cabin", paint, `pillar-a-${s}`, [s * (hw - 0.1) - 0.04, bodyTop - 0.01, c1 - 0.3], [s * (hw - 0.1) + 0.04, ch - 0.06, c1 - 0.16])
      b.span("cabin", paint, `pillar-c-${s}`, [s * (hw - 0.1) - 0.04, bodyTop - 0.01, c0 + 0.16], [s * (hw - 0.1) + 0.04, ch - 0.06, c0 + 0.34])
    }
    if (c.style === "taxi") {
      b.span("cabin", "sign", "taxi-sign", [-0.28, ch, d.cabinOff - 0.12], [0.28, ch + 0.16, d.cabinOff + 0.12], { bevel: 0.03 })
    }

    // Lamps.
    const heads = [b.span("lamps", "head", "head-l", [-hw + 0.12, bodyTop - 0.22, hl - 0.13], [-hw + 0.45, bodyTop - 0.08, hl - 0.07], { bevel: 0.02 }),
      b.span("lamps", "head", "head-r", [hw - 0.45, bodyTop - 0.22, hl - 0.13], [hw - 0.12, bodyTop - 0.08, hl - 0.07], { bevel: 0.02 })]
    const tails = [b.span("lamps", "tail", "tail-l", [-hw + 0.1, bodyTop - 0.2, -hl + 0.07], [-hw + 0.4, bodyTop - 0.08, -hl + 0.13], { bevel: 0.02 }),
      b.span("lamps", "tail", "tail-r", [hw - 0.4, bodyTop - 0.2, -hl + 0.07], [hw - 0.1, bodyTop - 0.08, -hl + 0.13], { bevel: 0.02 })]
    heads.forEach((m) => { m.userData.vibe3dRole = "car.head" })
    tails.forEach((m) => { m.userData.vibe3dRole = "car.tail" })

    // Wheels: axle along X; spun about X in update().
    const axle = hl - 0.2 - d.wheelR * 1.25
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const x = sx * (hw - 0.14)
      const tyre = b.cylinder("wheels", "tyre", `tyre-${sx}${sz}`, d.wheelR, 0.24, [x, d.wheelR, sz * axle], { rot: [0, 0, Math.PI / 2], segments: 18 })
      const hub = b.cylinder("wheels", "hub", `hub-${sx}${sz}`, d.wheelR * 0.55, 0.26, [x, d.wheelR, sz * axle], { rot: [0, 0, Math.PI / 2], segments: 6 })
      tyre.userData.vibe3dRole = "car.wheel"
      hub.userData.vibe3dRole = "car.wheel"
    }
  },
  sockets: () => ({}),
  actions: ({ parts, config }) => {
    let speed = 0
    let spin = 0
    let brake = false
    return {
      actions: {
        setSpeed(v: number) { speed = v },
        setBrake(on: boolean) { brake = on },
      },
      update(dt: number) {
        spin += (speed / DIMS[config().style].wheelR) * dt
        parts.wheels.anchor.traverse((o) => { if (o.userData.vibe3dRole === "car.wheel") (o as Mesh).rotation.x = spin })
        parts.lamps.anchor.traverse((o) => { if (o.userData.vibe3dRole === "car.tail") (o as Mesh).scale.setScalar(brake ? 1.12 : 1) })
      },
    }
  },
}

export type Car = ModelInstance<CarConfig, Record<string, PartHandle<Group>>, CarActions>

export function createCar(kit: ShopKit, config: Partial<CarConfig> = {}, materials: Partial<Record<string, Material>> = {}): Car {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<CarConfig> = {}) {
  return createCar(kit, config)
}
