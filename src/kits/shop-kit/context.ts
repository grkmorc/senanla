/**
 * @shop-kit context and shared model runtime.
 * A kit is an explicit dependency scope, not a scene object or singleton.
 */
import {
  Group, Mesh, Material, BoxGeometry, CylinderGeometry, TorusGeometry, Vector3, Euler, Object3D,
} from "three"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import {
  type ModelDefinition, type ModelInstance, type MaterialBindings, type PartHandle,
  type SocketMap, type ConfigureResult, Ownership, createPart, createSocket, tag, applyPatch,
} from "@/lib/vibe3d/model"
import { type ShopMaterialSource, type ShopSlot, createShopMaterialSource } from "./materials"

export interface ShopKit {
  readonly namespace: "@shop-kit"
  readonly materials: ShopMaterialSource
  /** Grid module in metres; models snap footprints to it. */
  readonly module: number
  dispose(): void
}

export function createShopKit(opts: { materials?: ShopMaterialSource } = {}): ShopKit {
  const ownsSource = !opts.materials
  const materials = opts.materials ?? createShopMaterialSource()
  return {
    namespace: "@shop-kit",
    materials,
    module: 0.5,
    dispose() {
      if (ownsSource) materials.dispose()
    },
  }
}

/* ------------------------------------------------------------------ */
/* Builder handed to each model's build function                       */
/* ------------------------------------------------------------------ */

type Vec3 = [number, number, number]

export interface BoxOpts {
  /** Physical bevel radius in metres; 0 = hard edge. */
  bevel?: number
  rot?: Vec3
}

export interface Builder {
  /** Box by size, centred at position. */
  box(part: string, slot: string, label: string, size: Vec3, pos: Vec3, opts?: BoxOpts): Mesh
  /** Box spanning min..max corners (keeps clearances exact). */
  span(part: string, slot: string, label: string, min: Vec3, max: Vec3, opts?: BoxOpts): Mesh
  cylinder(part: string, slot: string, label: string, radius: number, height: number, pos: Vec3, opts?: { rot?: Vec3; segments?: number; radiusTop?: number }): Mesh
  /** Ring lying in the XZ plane (hole along Y) unless rotated. */
  torus(part: string, slot: string, label: string, radius: number, tube: number, pos: Vec3, opts?: { rot?: Vec3; segments?: number }): Mesh
  /** Deterministic PRNG seeded from model id + config. */
  random(): number
}

export interface ShopModelSpec<Config, Actions> {
  definition: ModelDefinition<Config>
  /** Model-local material slot -> kit slot. */
  slotMap: Record<string, ShopSlot>
  build(b: Builder, config: Config): void
  sockets(config: Config): Record<string, { kind: string; at: Vec3 }>
  actions?: (ctx: { parts: Record<string, PartHandle<Group>>; config: () => Config }) => {
    actions: Actions
    update?: (dt: number) => void
  }
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generic ModelInstance implementation for @shop-kit models.
 * Root and part anchors keep identity across configure(); only content is replaced.
 */
export function instantiateShopModel<Config extends object, Actions = Record<string, never>>(
  kit: ShopKit,
  spec: ShopModelSpec<Config, Actions>,
  initial: Partial<Config> = {},
  materialOverrides: Partial<Record<string, Material>> = {},
): ModelInstance<Config, Record<string, PartHandle<Group>>, Actions> {
  const def = spec.definition
  const modelAddress = `@shop-kit/${def.id}`
  let config = applyPatch(def, { ...def.defaults } as Config, initial).next

  const root = new Group()
  root.name = def.id
  root.userData.vibe3d = { model: modelAddress }

  // --- parts -----------------------------------------------------------
  const partHandles: Record<string, PartHandle<Group>> = {}
  const partReplace: Record<string, (o: Object3D) => void> = {}
  for (const p of def.parts) {
    const { handle, replace } = createPart(root, def.id, p)
    partHandles[p] = handle
    partReplace[p] = replace
  }

  // --- sockets (stable anchors, repositioned on rebuild) ---------------
  const socketGroup = new Group()
  socketGroup.name = `${def.id}/sockets`
  root.add(socketGroup)
  const sockets: SocketMap = {}
  const placeSockets = () => {
    const s = spec.sockets(config)
    for (const [name, v] of Object.entries(s)) {
      if (!sockets[name]) sockets[name] = createSocket(socketGroup, def.id, name, v.kind, new Vector3(...v.at))
      else sockets[name].anchor.position.set(...v.at)
    }
  }

  // --- materials -------------------------------------------------------
  const instanceOverrides = new Map<string, Material>(Object.entries(materialOverrides) as [string, Material][])
  const acquired = new Map<string, Material>()
  const resolve = (slot: string): Material => {
    const o = instanceOverrides.get(slot)
    if (o) return o
    let m = acquired.get(slot)
    if (!m) {
      const kitSlot = spec.slotMap[slot]
      if (!kitSlot) throw new Error(`${modelAddress}: unknown material slot "${slot}"`)
      m = kit.materials.acquire(kitSlot)
      acquired.set(slot, m)
    }
    return m
  }
  const releaseAcquired = () => {
    acquired.forEach((m, slot) => kit.materials.release(spec.slotMap[slot], m))
    acquired.clear()
  }

  // --- build -----------------------------------------------------------
  let ownership = new Ownership()
  const rebuild = () => {
    ownership.release()
    releaseAcquired()
    ownership = new Ownership()
    const contents: Record<string, Group> = {}
    for (const p of def.parts) {
      const g = new Group()
      g.name = `${def.id}/${p}/content`
      contents[p] = g
    }
    const rng = mulberry32(hashSeed(def.id + JSON.stringify(config)))
    const add = (part: string, slot: string, label: string, geo: Mesh["geometry"], pos: Vec3, rot?: Vec3) => {
      const target = contents[part]
      if (!target) throw new Error(`${modelAddress}: unknown part "${part}"`)
      const mesh = new Mesh(ownership.own(geo), resolve(slot))
      mesh.position.set(...pos)
      if (rot) mesh.rotation.copy(new Euler(...rot))
      tag(mesh, modelAddress, part, slot, label)
      target.add(mesh)
      return mesh
    }
    const boxGeo = (size: Vec3, bevel = 0) => {
      const r = Math.min(bevel, Math.min(...size) / 2 - 1e-4)
      return r > 0 ? new RoundedBoxGeometry(size[0], size[1], size[2], 2, r) : new BoxGeometry(...size)
    }
    const b: Builder = {
      box: (part, slot, label, size, pos, o = {}) => add(part, slot, label, boxGeo(size, o.bevel), pos, o.rot),
      span: (part, slot, label, min, max, o = {}) => {
        const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
        const pos: Vec3 = [(max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2]
        return add(part, slot, label, boxGeo(size, o.bevel), pos, o.rot)
      },
      torus: (part, slot, label, radius, tube, pos, o = {}) =>
        add(part, slot, label, new TorusGeometry(radius, tube, 8, o.segments ?? 20).rotateX(Math.PI / 2), pos, o.rot),
      cylinder: (part, slot, label, radius, height, pos, o = {}) =>
        add(part, slot, label, new CylinderGeometry(o.radiusTop ?? radius, radius, height, o.segments ?? 16), pos, o.rot),
      random: rng,
    }
    spec.build(b, config)
    for (const p of def.parts) partReplace[p](contents[p])
    placeSockets()
    const env = def.envelope(config)
    root.userData.vibe3d.envelope = env
  }
  rebuild()

  const materials: MaterialBindings = {
    get: (slot) => resolve(slot),
    override(slot, material) {
      instanceOverrides.set(slot, material)
      rebuild()
    },
    reset(slot) {
      instanceOverrides.delete(slot)
      rebuild()
    },
    slots: () => def.materialSlots,
  }

  const runtime = spec.actions?.({ parts: partHandles, config: () => config })
  let disposed = false

  return {
    root,
    parts: partHandles,
    actions: (runtime?.actions ?? {}) as Actions,
    materials,
    sockets,
    getConfig: () => Object.freeze({ ...config }),
    configure(patch): ConfigureResult {
      const { next, clamped } = applyPatch(def, config, patch)
      const changed = JSON.stringify(next) !== JSON.stringify(config)
      config = next
      if (changed) rebuild()
      return { rebuilt: changed, clamped }
    },
    update(dt) {
      if (!disposed) runtime?.update?.(dt)
    },
    dispose() {
      if (disposed) return
      disposed = true
      ownership.release()
      releaseAcquired()
      root.removeFromParent()
    },
  }
}
