/**
 * Street traffic: cars follow straight lanes, keep a following gap, stop at the stop line
 * on amber/red and yield to pedestrians in front of them. A fixed-cycle controller drives
 * the two signal groups (E-W and N-S). App-level simulation; cars are @shop-kit models.
 */
import { Vector3, type Object3D } from "three"
import type { ShopKit } from "@/kits/shop-kit/context"
import { createCar, type Car, type CarConfig, type CarPaint } from "@/models/shop-kit/car"
import type { Signal } from "@/models/shop-kit/traffic-light"

export type SignalGroup = "ew" | "ns"

export interface Lane {
  id: string
  /** Lane start (outside the visible area) at road height. */
  from: Vector3
  /** Unit heading. */
  dir: Vector3
  length: number
  /** Distance along the lane of the stop line, if the lane is signalised. */
  stopAt: number | null
  group: SignalGroup
}

interface Vehicle {
  model: Car
  lane: Lane
  s: number
  v: number
  cruise: number
  len: number
  active: boolean
}

const LENGTHS: Record<CarConfig["style"], number> = { sedan: 4.3, taxi: 4.3, hatch: 3.7, van: 4.8 }
const PAINTS: CarPaint[] = ["red", "blue", "white", "black", "teal", "silver", "white", "silver"]

/** Fixed-time signal plan: seconds per phase. */
const PLAN: { ew: Signal; ns: Signal; t: number }[] = [
  { ew: "green", ns: "red", t: 11 },
  { ew: "amber", ns: "red", t: 2.5 },
  { ew: "red", ns: "red", t: 1.5 },
  { ew: "red", ns: "green", t: 9 },
  { ew: "red", ns: "amber", t: 2.5 },
  { ew: "red", ns: "red", t: 1.5 },
]

export class SignalController {
  private phase = 0
  private t = 0
  get ew() { return PLAN[this.phase].ew }
  get ns() { return PLAN[this.phase].ns }
  of(g: SignalGroup) { return g === "ew" ? this.ew : this.ns }
  update(dt: number) {
    this.t += dt
    while (this.t >= PLAN[this.phase].t) {
      this.t -= PLAN[this.phase].t
      this.phase = (this.phase + 1) % PLAN.length
    }
  }
}

export class Traffic {
  private readonly cars: Vehicle[] = []
  private readonly tmp = new Vector3()

  constructor(
    private readonly kit: ShopKit,
    private readonly scene: Object3D,
    private readonly lanes: Lane[],
    private readonly signals: SignalController,
    private readonly rng: () => number,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const lane = lanes[i % lanes.length]
      const cfg = this.randomConfig()
      const model = createCar(kit, cfg)
      model.root.traverse((o) => { o.castShadow = true })
      scene.add(model.root)
      // Spread the initial fleet along each lane so the street starts busy.
      const perLane = Math.ceil(count / lanes.length)
      const slot = Math.floor(i / lanes.length)
      const s = (lane.length * (slot + 0.5 + (rng() - 0.5) * 0.4)) / perLane
      const car: Vehicle = { model, lane, s, v: 5, cruise: 6 + rng() * 2.5, len: LENGTHS[cfg.style ?? "sedan"], active: true }
      this.cars.push(car)
      this.place(car)
    }
  }

  private randomConfig(): Partial<CarConfig> {
    const r = this.rng()
    const style: CarConfig["style"] = r < 0.12 ? "taxi" : r < 0.3 ? "van" : r < 0.6 ? "hatch" : "sedan"
    return { style, paint: PAINTS[Math.floor(this.rng() * PAINTS.length)] }
  }

  private place(c: Vehicle) {
    const p = this.tmp.copy(c.lane.from).addScaledVector(c.lane.dir, c.s)
    c.model.root.position.copy(p)
    c.model.root.rotation.y = Math.atan2(c.lane.dir.x, c.lane.dir.z)
  }

  /** Nearest car ahead in the same lane, as bumper-to-bumper gap. */
  private gapAhead(c: Vehicle): number {
    let gap = Infinity
    for (const o of this.cars) {
      if (o === c || !o.active || o.lane !== c.lane || o.s <= c.s) continue
      gap = Math.min(gap, o.s - c.s - (o.len + c.len) / 2)
    }
    return gap
  }

  update(dt: number, pedestrians: Vector3[]) {
    for (const c of this.cars) {
      if (!c.active) {
        // Re-enter when the lane start is clear.
        const clear = this.cars.every((o) => o === c || !o.active || o.lane !== c.lane || o.s > o.len + 6)
        if (clear) {
          c.active = true
          c.s = 0
          c.v = c.cruise * 0.8
          c.model.root.visible = true
        }
        continue
      }
      let target = c.cruise
      // Following distance: ~1.2 s headway plus 2 m standstill gap.
      const gap = this.gapAhead(c)
      if (gap < 2 + c.v * 1.4) target = Math.min(target, Math.max(0, (gap - 2) / 1.2))
      // Signals.
      const lane = c.lane
      const front = c.s + c.len / 2
      if (lane.stopAt !== null && front < lane.stopAt + 0.2) {
        const sig = this.signals.of(lane.group)
        const dist = lane.stopAt - front - 0.3
        const committed = sig === "amber" && dist < 2.5
        if (sig !== "green" && !committed && dist < 30) target = Math.min(target, Math.max(0, dist * 0.55))
      }
      // Yield to anyone standing in the lane ahead.
      const fx = c.model.root.position.x + lane.dir.x * c.len / 2
      const fz = c.model.root.position.z + lane.dir.z * c.len / 2
      for (const p of pedestrians) {
        const dx = p.x - fx
        const dz = p.z - fz
        const along = dx * lane.dir.x + dz * lane.dir.z
        const lateral = Math.abs(dx * lane.dir.z - dz * lane.dir.x)
        if (along > -0.5 && along < 8 && lateral < 1.4) target = Math.min(target, Math.max(0, (along - 1.5) * 0.9))
      }
      const dv = target - c.v
      c.v = Math.max(0, c.v + Math.max(-9 * dt, Math.min(3 * dt, dv)))
      c.s += c.v * dt
      c.model.actions.setSpeed(c.v)
      c.model.actions.setBrake(dv < -0.3 || c.v < 0.3)
      if (c.s > lane.length) {
        // Leave the map; come back on a random lane with a fresh body.
        c.active = false
        c.model.root.visible = false
        c.lane = this.lanes[Math.floor(this.rng() * this.lanes.length)]
        const cfg = this.randomConfig()
        c.model.configure(cfg)
        c.len = LENGTHS[cfg.style ?? "sedan"]
        c.cruise = 6 + this.rng() * 2.5
        continue
      }
      this.place(c)
      c.model.update(dt)
    }
  }

  /** Bumper-to-bumper minimum over all same-lane pairs (tests). */
  minGap(): number {
    let g = Infinity
    for (const c of this.cars) if (c.active) g = Math.min(g, this.gapAhead(c))
    return g
  }

  get vehicles() { return this.cars.filter((c) => c.active).map((c) => ({ lane: c.lane.id, s: c.s, v: c.v, model: c.model })) }

  dispose() {
    this.cars.forEach((c) => c.model.dispose())
    this.cars.length = 0
    void this.kit
    void this.scene
  }
}
