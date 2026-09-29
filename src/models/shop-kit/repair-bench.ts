/**
 * @shop-kit/repair-bench — steel-frame workbench with butcher-block top,
 * pegboard riser, hung tools, bench vise and an articulated task lamp.
 * Pivot: floor centre. The technician stands on the +Z side.
 */
import type { Group, Material, Mesh } from "three"
import type { ModelDefinition, ModelInstance, PartHandle } from "@/lib/vibe3d/model"
import { type ShopKit, type ShopModelSpec, createShopKit, instantiateShopModel } from "@/kits/shop-kit/context"

export interface RepairBenchConfig {
  width: number
  depth: number
  height: number
  riser: boolean
  vise: "left" | "right" | "none"
}

export interface RepairBenchActions {
  setLamp(on: boolean): void
  toggleLamp(): boolean
  readonly lampOn: boolean
}

const LEG = 0.05
const TOP_T = 0.05

export const repairBenchDefinition: ModelDefinition<RepairBenchConfig> = {
  id: "repair-bench",
  title: "Repair Bench",
  description: "Workbench with pegboard riser, tools, vise and a switchable task lamp.",
  categories: ["furniture", "workshop"],
  defaults: { width: 1.8, depth: 0.75, height: 0.9, riser: true, vise: "right" },
  fields: {
    width: { type: "number", min: 1, max: 3, step: 0.1, unit: "m", doc: "Bench width." },
    depth: { type: "number", min: 0.5, max: 1, step: 0.05, unit: "m", doc: "Bench depth." },
    height: { type: "number", min: 0.7, max: 1.1, step: 0.05, unit: "m", doc: "Work surface height." },
    riser: { type: "boolean", doc: "Pegboard riser with hung tools." },
    vise: { type: "enum", options: ["left", "right", "none"], doc: "Vise position." },
  },
  materialSlots: ["frame", "top", "shelf", "riser", "tool", "grip", "vise", "bulb"],
  parts: ["frame", "top", "riser", "tools", "lamp"],
  sockets: ["work"],
  actions: ["setLamp", "toggleLamp"],
  envelope: (c) => ({ width: c.width, depth: c.depth, height: c.riser ? c.height + 0.9 : c.height + 0.6 }),
  capabilities: ["webgl"],
}

const spec: ShopModelSpec<RepairBenchConfig, RepairBenchActions> = {
  definition: repairBenchDefinition,
  slotMap: {
    frame: "hardware.steelDark",
    top: "surface.wood",
    shelf: "surface.woodDark",
    riser: "surface.paint",
    tool: "hardware.steel",
    grip: "prop.goodsA",
    vise: "surface.paint",
    bulb: "signal.amber",
  },
  build(b, c) {
    const hw = c.width / 2
    const hd = c.depth / 2
    const topY = c.height - TOP_T

    // Frame: legs inset 40 mm from top edges; aprons and a lower stretcher.
    const lx = hw - 0.04 - LEG / 2
    const lz = hd - 0.04 - LEG / 2
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.box("frame", "frame", `leg-${sx}${sz}`, [LEG, topY, LEG], [sx * lx, topY / 2, sz * lz], { bevel: 0.005 })
    }
    b.span("frame", "frame", "apron-front", [-lx + LEG / 2, topY - 0.09, lz - 0.015], [lx - LEG / 2, topY - 0.005, lz + 0.015])
    b.span("frame", "frame", "apron-back", [-lx + LEG / 2, topY - 0.09, -lz - 0.015], [lx - LEG / 2, topY - 0.005, -lz + 0.015])
    b.span("frame", "shelf", "lower-shelf", [-lx - LEG / 2 + 0.002, 0.16, -lz - LEG / 2 + 0.002], [lx + LEG / 2 - 0.002, 0.185, lz + LEG / 2 - 0.002])

    // Top: thick slab with 30 mm overhang.
    b.span("top", "top", "worktop", [-hw, topY, -hd], [hw, c.height, hd], { bevel: 0.008 })

    // Riser: pegboard standing on the rear of the worktop.
    if (c.riser) {
      const rTop = c.height + 0.8
      b.span("riser", "frame", "riser-post-l", [-hw + 0.02, c.height, -hd + 0.02], [-hw + 0.06, rTop, -hd + 0.06])
      b.span("riser", "frame", "riser-post-r", [hw - 0.06, c.height, -hd + 0.02], [hw - 0.02, rTop, -hd + 0.06])
      b.span("riser", "riser", "pegboard", [-hw + 0.06, c.height + 0.12, -hd + 0.03], [hw - 0.06, rTop - 0.02, -hd + 0.045])
      b.span("riser", "shelf", "riser-shelf", [-hw + 0.06, rTop - 0.2, -hd + 0.045], [hw - 0.06, rTop - 0.18, -hd + 0.2])

      // Hung tools on the pegboard face (+Z), 8 mm proud.
      const face = -hd + 0.045
      const tools = Math.max(3, Math.floor((c.width - 0.4) / 0.22))
      for (let i = 0; i < tools; i++) {
        const x = -hw + 0.25 + i * ((c.width - 0.5) / Math.max(1, tools - 1))
        const kind = i % 3
        const yTop = rTop - 0.3
        if (kind === 0) {
          // Wrench: shank + jaw.
          b.span("tools", "tool", `wrench-${i}`, [x - 0.012, yTop - 0.28, face + 0.008], [x + 0.012, yTop, face + 0.02])
          b.span("tools", "tool", `wrench-jaw-${i}`, [x - 0.035, yTop - 0.04, face + 0.006], [x + 0.035, yTop + 0.01, face + 0.017])
        } else if (kind === 1) {
          // Screwdriver: grip + shaft.
          b.span("tools", "grip", `driver-grip-${i}`, [x - 0.018, yTop - 0.11, face + 0.008], [x + 0.018, yTop, face + 0.044], { bevel: 0.008 })
          b.cylinder("tools", "tool", `driver-shaft-${i}`, 0.005, 0.16, [x, yTop - 0.19, face + 0.026])
        } else {
          // Hammer: handle + head.
          b.span("tools", "shelf", `hammer-handle-${i}`, [x - 0.012, yTop - 0.3, face + 0.008], [x + 0.012, yTop - 0.02, face + 0.03])
          b.span("tools", "tool", `hammer-head-${i}`, [x - 0.06, yTop - 0.03, face + 0.006], [x + 0.06, yTop + 0.02, face + 0.04], { bevel: 0.006 })
        }
      }
    }

    // Vise clamped over the front edge.
    if (c.vise !== "none") {
      const s = c.vise === "right" ? 1 : -1
      const vx = s * (hw - 0.22)
      const y0 = c.height
      b.span("tools", "vise", "vise-body", [vx - 0.08, y0, hd - 0.2], [vx + 0.08, y0 + 0.08, hd - 0.02], { bevel: 0.01 })
      b.span("tools", "vise", "vise-jaw", [vx - 0.07, y0 - 0.06, hd + 0.01], [vx + 0.07, y0 + 0.1, hd + 0.05], { bevel: 0.008 })
      b.span("tools", "tool", "jaw-plate-a", [vx - 0.065, y0 + 0.07, hd - 0.021], [vx + 0.065, y0 + 0.105, hd - 0.012])
      b.cylinder("tools", "tool", "vise-screw", 0.009, 0.2, [vx, y0 + 0.045, hd + 0.08], { rot: [Math.PI / 2, 0, 0] })
      b.cylinder("tools", "tool", "vise-handle", 0.006, 0.18, [vx, y0 + 0.045, hd + 0.17], { rot: [0, 0, Math.PI / 2] })
    }

    // Task lamp on the opposite end from the vise: base, post, reach arm, conical shade.
    const ls = c.vise === "left" ? 1 : -1
    const lampX = ls * (hw - 0.16)
    const lampZ = -hd + 0.3
    const y0 = c.height
    const postH = 0.46
    const reach = 0.34
    const armY = y0 + 0.025 + postH
    b.cylinder("lamp", "frame", "lamp-base", 0.075, 0.025, [lampX, y0 + 0.0125, lampZ], { segments: 20 })
    b.cylinder("lamp", "frame", "lamp-post", 0.012, postH, [lampX, y0 + 0.025 + postH / 2, lampZ], { segments: 10 })
    b.box("lamp", "frame", "lamp-knuckle", [0.04, 0.04, 0.04], [lampX, armY, lampZ], { bevel: 0.01 })
    b.cylinder("lamp", "frame", "lamp-arm", 0.01, reach, [lampX - ls * reach / 2, armY + 0.0005, lampZ], { rot: [0, 0, Math.PI / 2], segments: 10 })
    const sx = lampX - ls * reach
    b.cylinder("lamp", "tool", "lamp-shade", 0.03, 0.1, [sx, armY - 0.05, lampZ], { radiusTop: 0.03, segments: 20 })
    b.cylinder("lamp", "tool", "lamp-hood", 0.085, 0.07, [sx, armY - 0.125, lampZ], { radiusTop: 0.032, segments: 24 })
    const bulb = b.cylinder("lamp", "bulb", "lamp-bulb", 0.07, 0.012, [sx, armY - 0.155, lampZ], { segments: 24 })
    bulb.userData.vibe3dRole = "lamp.bulb"
  },
  sockets: (c) => ({ work: { kind: "nav.interact", at: [0, 0, c.depth / 2 + 0.45] } }),
  actions: ({ parts }) => {
    let on = true
    const apply = () => {
      parts.lamp.anchor.traverse((o) => {
        if (o.userData.vibe3dRole === "lamp.bulb") (o as Mesh).visible = on
        if (o.userData.vibe3dRole === "lamp.light") o.visible = on
      })
    }
    return {
      actions: {
        setLamp(v: boolean) { on = v; apply() },
        toggleLamp() { on = !on; apply(); return on },
        get lampOn() { return on },
      },
      // Re-assert state each frame: cheap, and survives rebuilds that recreate the bulb.
      update: () => apply(),
    }
  },
}

export type RepairBench = ModelInstance<RepairBenchConfig, Record<string, PartHandle<Group>>, RepairBenchActions>

export function createRepairBench(kit: ShopKit, config: Partial<RepairBenchConfig> = {}, materials: Partial<Record<string, Material>> = {}): RepairBench {
  return instantiateShopModel(kit, spec, config, materials)
}

export function createModel(kit: ShopKit = createShopKit(), config: Partial<RepairBenchConfig> = {}) {
  return createRepairBench(kit, config)
}
