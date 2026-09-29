/**
 * App-level pawns (player and customers). Characters are outside vibe-model's
 * scope, so these stay stylised placeholders owned by the app, not registry models.
 * Articulated: hip and shoulder pivots drive a distance-based walk cycle.
 */
import {
  Group, Mesh, CapsuleGeometry, SphereGeometry, MeshStandardMaterial,
  Vector3, MathUtils, type BufferGeometry, type Material,
} from "three"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import type { NavGrid } from "./nav-grid"

export interface PawnLook {
  skin: string
  shirt: string
  pants: string
  hair: string
  /** Shop apron (player). */
  apron?: string
}

// Geometry is shared by every pawn; disposed once via disposePawnAssets().
const geo = {
  torso: new CapsuleGeometry(0.17, 0.26, 6, 16),
  leg: new CapsuleGeometry(0.068, 0.3, 4, 10),
  arm: new CapsuleGeometry(0.05, 0.28, 4, 10),
  hand: new SphereGeometry(0.055, 12, 8),
  shoe: new RoundedBoxGeometry(0.12, 0.07, 0.19, 2, 0.025),
  head: new SphereGeometry(0.165, 24, 16),
  hair: new SphereGeometry(0.178, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
  eye: new SphereGeometry(0.022, 8, 6),
  apron: new RoundedBoxGeometry(0.3, 0.42, 0.03, 2, 0.012),
  carry: new RoundedBoxGeometry(0.24, 0.17, 0.2, 2, 0.02),
}
const shared = {
  eye: new MeshStandardMaterial({ color: "#1b1b1f", roughness: 0.3 }),
  shoe: new MeshStandardMaterial({ color: "#2a2522", roughness: 0.8 }),
}

export function disposePawnAssets() {
  Object.values(geo).forEach((g) => g.dispose())
  Object.values(shared).forEach((m) => m.dispose())
}

export const CUSTOMER_LOOKS: PawnLook[] = [
  { skin: "#e8c4a0", shirt: "#4f7cac", pants: "#3a3f4a", hair: "#3b2a20" },
  { skin: "#8c5a3c", shirt: "#c8553d", pants: "#2e3440", hair: "#15110f" },
  { skin: "#f0d2b0", shirt: "#e3b23c", pants: "#5a4a3a", hair: "#b8803a" },
  { skin: "#b07850", shirt: "#6a8d5a", pants: "#2b2f36", hair: "#241a14" },
  { skin: "#d9a47a", shirt: "#8e5c9e", pants: "#44474f", hair: "#5c3a24" },
  { skin: "#f3d6bd", shirt: "#d97a8a", pants: "#35507a", hair: "#9a9a9a" },
]

export class Pawn {
  readonly root = new Group()
  readonly speed: number
  private path: Vector3[] = []
  private readonly mats: Material[] = []
  private readonly carryMat: MeshStandardMaterial
  private readonly carryMesh: Mesh
  private readonly body = new Group()
  private readonly hips: Group[] = []
  private readonly shoulders: Group[] = []
  private phase = Math.random() * Math.PI * 2
  private stride = 0
  private idleT = Math.random() * 10
  private carrying = false
  private onArrive: (() => void) | null = null

  constructor(look: PawnLook, speed = 2.6) {
    this.speed = speed
    this.root.userData.excludeFromExport = true
    const mat = (color: string, roughness = 0.65) => {
      const m = new MeshStandardMaterial({ color, roughness })
      this.mats.push(m)
      return m
    }
    const skin = mat(look.skin, 0.55)
    const shirt = mat(look.shirt)
    const pants = mat(look.pants, 0.8)
    const hair = mat(look.hair, 0.85)
    this.carryMat = mat("#b98b52", 0.75)

    const add = (parent: Group, g: BufferGeometry, m: Material, x: number, y: number, z: number) => {
      const mesh = new Mesh(g, m)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      parent.add(mesh)
      return mesh
    }
    this.root.add(this.body)

    for (const side of [-1, 1]) {
      const hip = new Group()
      hip.position.set(side * 0.085, 0.5, 0)
      add(hip, geo.leg, pants, 0, -0.22, 0)
      add(hip, geo.shoe, shared.shoe, 0, -0.465, 0.03)
      this.body.add(hip)
      this.hips.push(hip)

      const shoulder = new Group()
      shoulder.position.set(side * 0.225, 0.93, 0)
      add(shoulder, geo.arm, shirt, 0, -0.19, 0)
      add(shoulder, geo.hand, skin, 0, -0.38, 0)
      shoulder.rotation.z = side * 0.08
      this.body.add(shoulder)
      this.shoulders.push(shoulder)
    }
    const torso = add(this.body, geo.torso, shirt, 0, 0.78, 0)
    torso.scale.set(1, 1, 0.82)
    if (look.apron) add(this.body, geo.apron, mat(look.apron, 0.75), 0, 0.68, 0.135)
    add(this.body, geo.head, skin, 0, 1.24, 0)
    const hairMesh = add(this.body, geo.hair, hair, 0, 1.255, -0.012)
    hairMesh.rotation.x = -0.25
    for (const side of [-1, 1]) add(this.body, geo.eye, shared.eye, side * 0.058, 1.255, 0.148)
    this.carryMesh = add(this.body, geo.carry, this.carryMat, 0, 0.74, 0.3)
    this.carryMesh.visible = false
  }

  get moving() { return this.path.length > 0 }

  /** World position just above the head, for UI bubbles. */
  headTop(out = new Vector3()) { return out.copy(this.root.position).setY(1.72) }

  setCarry(color: string | null) {
    this.carrying = color !== null
    this.carryMesh.visible = this.carrying
    if (color) this.carryMat.color.set(color)
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
    let travelled = 0
    const hadPath = this.path.length > 0
    if (this.path.length) {
      const next = this.path[0]
      const to = new Vector3(next.x - this.root.position.x, 0, next.z - this.root.position.z)
      const dist = to.length()
      const step = this.speed * dt
      if (dist <= step) {
        this.root.position.x = next.x
        this.root.position.z = next.z
        this.path.shift()
        travelled = dist
      } else {
        to.multiplyScalar(step / dist)
        this.root.position.add(to)
        travelled = step
      }
      if (dist > 1e-4) this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(to.x, to.z), 1 - Math.exp(-dt * 14))
    }
    this.animate(dt, travelled)
    // Arrive whenever the path empties this frame, even with zero distance to cover
    // (clicking the spot you're already standing on).
    if (hadPath && !this.path.length) this.arrive()
  }

  private animate(dt: number, travelled: number) {
    // Stride amount eases in and out so starts and stops don't snap.
    const walking = travelled > 0
    this.stride = MathUtils.damp(this.stride, walking ? 1 : 0, 10, dt)
    this.phase += (travelled / 0.62) * Math.PI * 2 // one full cycle per 0.62 m
    this.idleT += dt
    const s = Math.sin(this.phase) * this.stride
    this.hips[0].rotation.x = s * 0.55
    this.hips[1].rotation.x = -s * 0.55
    const carryPose = this.carrying ? -1.05 : 0
    const breath = Math.sin(this.idleT * 2.2) * 0.03 * (1 - this.stride)
    this.shoulders[0].rotation.x = this.carrying ? carryPose : -s * 0.5 + breath
    this.shoulders[1].rotation.x = this.carrying ? carryPose : s * 0.5 + breath
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.035 * this.stride
    this.body.rotation.z = s * 0.03
  }

  private arrive() {
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
