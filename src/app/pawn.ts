/**
 * App-level pawns (player and customers). Characters are outside vibe-model's
 * scope, so these stay simple placeholders owned by the app, not registry models.
 */
import {
  Group, Mesh, CapsuleGeometry, CylinderGeometry, SphereGeometry, BoxGeometry,
  MeshStandardMaterial, DoubleSide, Vector3, MathUtils, type BufferGeometry,
} from "three"
import type { NavGrid } from "./nav-grid"

export interface PawnLook {
  body: string
  apron: string
  /** Optional carried box (shopping / repair item). */
  carry?: string
}

// Geometry is shared by every pawn; disposed once via disposePawnAssets().
const geo = {
  body: new CapsuleGeometry(0.2, 0.7, 6, 16),
  apron: new CylinderGeometry(0.205, 0.215, 0.5, 16, 1, true, -Math.PI / 2.2, Math.PI / 1.1),
  head: new SphereGeometry(0.16, 20, 14),
  nose: new SphereGeometry(0.045, 10, 8),
  carry: new BoxGeometry(0.22, 0.16, 0.18),
}

export function disposePawnAssets() {
  Object.values(geo).forEach((g) => g.dispose())
}

export class Pawn {
  readonly root = new Group()
  readonly speed: number
  private path: Vector3[] = []
  private readonly mats: MeshStandardMaterial[] = []
  private readonly carryMesh: Mesh
  private bobT = Math.random() * 10
  private onArrive: (() => void) | null = null

  constructor(look: PawnLook, speed = 2.6) {
    this.speed = speed
    this.root.userData.excludeFromExport = true
    const body = new MeshStandardMaterial({ color: look.body, roughness: 0.5 })
    const apron = new MeshStandardMaterial({ color: look.apron, roughness: 0.7, side: DoubleSide })
    const carry = new MeshStandardMaterial({ color: look.carry ?? "#b98b52", roughness: 0.75 })
    this.mats.push(body, apron, carry)
    const add = (g: BufferGeometry, m: MeshStandardMaterial, x: number, y: number, z: number) => {
      const mesh = new Mesh(g, m)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      this.root.add(mesh)
      return mesh
    }
    add(geo.body, body, 0, 0.55, 0)
    add(geo.apron, apron, 0, 0.5, 0)
    add(geo.head, body, 0, 1.18, 0)
    add(geo.nose, apron, 0, 1.2, 0.15)
    this.carryMesh = add(geo.carry, carry, 0, 0.72, 0.26)
    this.carryMesh.visible = false
  }

  get moving() { return this.path.length > 0 }

  setCarry(color: string | null) {
    this.carryMesh.visible = color !== null
    if (color) this.mats[2].color.set(color)
  }

  /** Plan a path; returns false when unreachable. `then` fires on arrival. */
  goTo(nav: NavGrid, x: number, z: number, then: (() => void) | null = null): boolean {
    const route = nav.findPath(this.root.position.x, this.root.position.z, x, z)
    if (!route) return false
    this.path = route.map(([px, pz]) => new Vector3(px, 0, pz))
    this.onArrive = then
    if (!this.path.length) this.arrive()
    return true
  }

  stop() { this.path = []; this.onArrive = null }

  get destination(): Vector3 | null { return this.path[this.path.length - 1] ?? null }

  faceTowards(p: Vector3) {
    this.root.rotation.y = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z)
  }

  update(dt: number) {
    if (!this.path.length) return
    const next = this.path[0]
    const to = new Vector3(next.x - this.root.position.x, 0, next.z - this.root.position.z)
    const dist = to.length()
    const step = this.speed * dt
    if (dist <= step) {
      this.root.position.x = next.x
      this.root.position.z = next.z
      this.path.shift()
    } else {
      to.multiplyScalar(step / dist)
      this.root.position.add(to)
    }
    if (dist > 1e-4) this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(to.x, to.z), 1 - Math.exp(-dt * 14))
    this.bobT += dt
    this.root.position.y = Math.abs(Math.sin(this.bobT * 14)) * 0.04
    if (!this.path.length) this.arrive()
  }

  private arrive() {
    this.root.position.y = 0
    const cb = this.onArrive
    this.onArrive = null
    cb?.()
  }

  dispose() {
    this.root.removeFromParent()
    this.mats.forEach((m) => m.dispose())
  }
}

export function lerpAngle(a: number, b: number, t: number) {
  const d = MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI
  return a + d * t
}
