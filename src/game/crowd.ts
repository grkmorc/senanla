/**
 * Customer bookkeeping shared by the shop and the repair desk: spawning pawns at the
 * door, a walking queue in front of a counter, and walking out when done.
 */
import { Vector3, type Object3D } from "three"
import type { NavGrid } from "@/app/nav-grid"
import { Pawn, CUSTOMER_LOOKS } from "@/app/pawn"

export interface CrowdDeps {
  scene: Object3D
  nav: NavGrid
  entrance: Vector3
  queueHead: Vector3
  /** Offset between queue slots; pick one that runs sideways on screen. */
  queueStep: Vector3
  /** Direction the first in line faces (towards the counter). */
  queueFacing: Vector3
  rng: () => number
}

export interface CrowdMember {
  pawn: Pawn
  /** Free-form state owned by the game using the crowd. */
  state: string
  patience: number
  maxPatience: number
}

export class Crowd<M extends CrowdMember> {
  readonly members: M[] = []
  readonly queue: M[] = []

  constructor(readonly d: CrowdDeps) {}

  spawn(make: (pawn: Pawn) => M): M {
    const look = CUSTOMER_LOOKS[Math.floor(this.d.rng() * CUSTOMER_LOOKS.length)]
    const pawn = new Pawn(look, 1.7 + this.d.rng() * 0.5)
    pawn.root.position.copy(this.d.entrance)
    pawn.root.rotation.y = Math.PI
    this.d.scene.add(pawn.root)
    const m = make(pawn)
    this.members.push(m)
    return m
  }

  joinQueue(m: M, patience: number) {
    m.state = "toQueue"
    m.patience = m.maxPatience = patience
    this.queue.push(m)
    this.reflow()
  }

  /** First in line, but only once they're standing at the counter. */
  head(): M | null {
    const h = this.queue[0]
    return h && h.state === "queued" ? h : null
  }

  dequeue(m: M) {
    const i = this.queue.indexOf(m)
    if (i >= 0) this.queue.splice(i, 1)
    this.reflow()
  }

  /** Walk every queued customer to their slot. */
  reflow() {
    this.queue.forEach((m, i) => {
      const slot = this.d.queueHead.clone().addScaledVector(this.d.queueStep, i)
      const dest = m.pawn.destination
      const standing = !m.pawn.moving && m.pawn.root.position.distanceTo(slot) < 0.05
      if (standing || (dest && dest.distanceTo(slot) < 0.05)) return
      m.state = "toQueue"
      m.pawn.goTo(this.d.nav, slot.x, slot.z, () => {
        m.state = "queued"
        m.pawn.faceTowards(slot.clone().add(this.d.queueFacing))
      })
    })
  }

  walkTo(m: M, at: Vector3, state: string, then?: () => void) {
    m.state = state
    if (!m.pawn.goTo(this.d.nav, at.x, at.z, then ?? null)) then?.()
  }

  leave(m: M) {
    this.dequeue(m)
    m.state = "leaving"
    const done = () => this.remove(m)
    if (!m.pawn.goTo(this.d.nav, this.d.entrance.x, this.d.entrance.z + 0.3, done)) done()
  }

  remove(m: M) {
    m.pawn.dispose()
    const i = this.members.indexOf(m)
    if (i >= 0) this.members.splice(i, 1)
    const q = this.queue.indexOf(m)
    if (q >= 0) this.queue.splice(q, 1)
  }

  update(dt: number) {
    for (const m of this.members) m.pawn.update(dt)
  }

  dispose() {
    this.members.forEach((m) => m.pawn.dispose())
    this.members.length = 0
    this.queue.length = 0
  }
}

export interface Mood {
  pawn: Pawn
  ratio: number
  kind: "buyer" | "repair"
}
