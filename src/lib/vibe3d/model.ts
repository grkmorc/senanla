/**
 * Vibe3D minimal Three.js model protocol (editable, consumer-owned).
 * Installed by `vibe3d init`. Registries build on these contracts without
 * inheriting from a shared base class.
 */
import { Group, Object3D, Material, Mesh, BufferGeometry, Vector3 } from "three"

export interface PartHandle<T extends Object3D = Object3D> {
  /** Stable for the model's lifetime. Parent your own objects here. */
  readonly anchor: T
  /** Generated content; replaced on rebuild. */
  readonly content: Object3D
}

export interface Socket {
  readonly anchor: Object3D
  readonly kind: string
}
export type SocketMap = Record<string, Socket>

export interface MaterialBindings {
  get(slot: string): Material
  override(slot: string, material: Material): void
  reset(slot: string): void
  slots(): readonly string[]
}

export interface ConfigureResult {
  readonly rebuilt: boolean
  readonly clamped: readonly string[]
}

export interface ModelInstance<
  Config,
  Parts = Record<string, PartHandle>,
  Actions = Record<string, never>,
> {
  readonly root: Group
  readonly parts: Parts
  readonly actions: Actions
  readonly materials: MaterialBindings
  readonly sockets: SocketMap
  getConfig(): Readonly<Config>
  configure(patch: Partial<Config>): ConfigureResult
  update(deltaSeconds: number): void
  dispose(): void
}

/** Serializable control schema for one configurable field. */
export interface FieldDefinition {
  readonly type: "number" | "integer" | "boolean" | "enum"
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly unit?: "m" | "deg" | "count"
  readonly options?: readonly string[]
  readonly doc: string
}

export interface ModelDefinition<Config> {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly categories: readonly string[]
  readonly defaults: Readonly<Config>
  readonly fields: { readonly [K in keyof Config]: FieldDefinition }
  readonly materialSlots: readonly string[]
  readonly parts: readonly string[]
  readonly sockets: readonly string[]
  readonly actions: readonly string[]
  /** Footprint on the XZ plane, metres, pivot at floor centre. */
  readonly envelope: (config: Config) => { width: number; depth: number; height: number }
  readonly capabilities: readonly string[]
}

/** Clamp a config patch against the definition's numeric limits. */
export function applyPatch<C extends object>(
  def: ModelDefinition<C>,
  current: C,
  patch: Partial<C>,
): { next: C; clamped: string[] } {
  const next = { ...current }
  const clamped: string[] = []
  for (const key of Object.keys(patch) as (keyof C)[]) {
    const field = def.fields[key]
    let value = patch[key] as unknown
    if (!field || value === undefined) continue
    if (field.type === "number" || field.type === "integer") {
      let n = Number(value)
      if (field.type === "integer") n = Math.round(n)
      const lo = field.min ?? -Infinity
      const hi = field.max ?? Infinity
      const c = Math.min(hi, Math.max(lo, n))
      if (c !== n) clamped.push(String(key))
      value = c
    } else if (field.type === "enum" && !field.options?.includes(String(value))) {
      clamped.push(String(key))
      continue
    }
    next[key] = value as C[keyof C]
  }
  return { next, clamped }
}

/**
 * Tracks resources the model created so dispose() frees exactly those.
 * Borrowed (kit or caller) materials are never disposed here.
 */
export class Ownership {
  private geometries = new Set<BufferGeometry>()
  private materials = new Set<Material>()
  own<T extends BufferGeometry | Material>(resource: T): T {
    if ((resource as BufferGeometry).isBufferGeometry) this.geometries.add(resource as BufferGeometry)
    else this.materials.add(resource as Material)
    return resource
  }
  release(): void {
    this.geometries.forEach((g) => g.dispose())
    this.materials.forEach((m) => m.dispose())
    this.geometries.clear()
    this.materials.clear()
  }
}

/** Create a semantic part: stable anchor + replaceable content. */
export function createPart(root: Object3D, modelId: string, name: string) {
  const anchor = new Group()
  anchor.name = `${modelId}/${name}`
  let content: Object3D = new Group()
  anchor.add(content)
  root.add(anchor)
  const handle = {
    anchor,
    get content() {
      return content
    },
  } as PartHandle<Group>
  const replace = (next: Object3D) => {
    anchor.remove(content)
    content = next
    anchor.add(content)
  }
  return { handle, replace }
}

/** Create a socket anchor positioned in the model's local space. */
export function createSocket(parent: Object3D, modelId: string, name: string, kind: string, at: Vector3): Socket {
  const anchor = new Object3D()
  anchor.name = `${modelId}/socket/${name}`
  anchor.position.copy(at)
  parent.add(anchor)
  return { anchor, kind }
}

/** Stamp durable inspection metadata onto generated meshes. */
export function tag(mesh: Mesh, model: string, part: string, materialSlot: string, label: string): Mesh {
  mesh.name = `${model.split("/").pop()}/${part}/${label}`
  mesh.userData.vibe3d = { model, part, materialSlot }
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
