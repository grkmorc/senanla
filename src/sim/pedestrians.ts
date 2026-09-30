/**
 * Pedestrians wander between random points on the sidewalks. The nav grid blocks the
 * roads except at zebra crossings, so they cross only there (cars yield to them).
 */
import type { Object3D } from "three"
import type { NavGrid } from "@/app/nav-grid"
import { Pawn, CUSTOMER_LOOKS } from "@/app/pawn"

export type Rect = [number, number, number, number] // x0, z0, x1, z1

export class Pedestrians {
  private readonly people: { pawn: Pawn; wait: number }[] = []

  constructor(
    private readonly scene: Object3D,
    private readonly nav: NavGrid,
    private readonly walkable: Rect[],
    private readonly rng: () => number,
    count: number,
    private readonly groundAt: (x: number, z: number) => number,
  ) {
    this.setCount(count)
  }

  get count() { return this.people.length }

  /** Grow or shrink the crowd; newcomers appear at random spots on the walkways. */
  setCount(n: number) {
    while (this.people.length < n) {
      const look = CUSTOMER_LOOKS[Math.floor(this.rng() * CUSTOMER_LOOKS.length)]
      const pawn = new Pawn(look, 1.1 + this.rng() * 0.6)
      const [x, z] = this.randomPoint()
      pawn.root.position.set(x, this.groundAt(x, z), z)
      pawn.root.rotation.y = this.rng() * Math.PI * 2
      this.scene.add(pawn.root)
      this.people.push({ pawn, wait: this.rng() * 3 })
    }
    while (this.people.length > n) this.people.pop()!.pawn.dispose()
  }

  /** Area-weighted random point on the sidewalks. */
  private randomPoint(): [number, number] {
    const areas = this.walkable.map(([x0, z0, x1, z1]) => (x1 - x0) * (z1 - z0))
    let r = this.rng() * areas.reduce((a, b) => a + b, 0)
    for (let i = 0; i < areas.length; i++) {
      r -= areas[i]
      if (r <= 0) {
        const [x0, z0, x1, z1] = this.walkable[i]
        return [x0 + this.rng() * (x1 - x0), z0 + this.rng() * (z1 - z0)]
      }
    }
    const [x0, z0] = this.walkable[0]
    return [x0, z0]
  }

  update(dt: number) {
    for (const p of this.people) {
      if (!p.pawn.moving) {
        p.wait -= dt
        if (p.wait <= 0) {
          const [x, z] = this.randomPoint()
          p.pawn.goTo(this.nav, x, z, () => { p.wait = 1 + this.rng() * 5 })
          p.wait = 2
        }
      }
      p.pawn.update(dt)
      p.pawn.root.position.y = this.groundAt(p.pawn.root.position.x, p.pawn.root.position.z)
    }
  }

  positions() { return this.people.map((p) => p.pawn.root.position) }

  dispose() { this.people.forEach((p) => p.pawn.dispose()) }
}
