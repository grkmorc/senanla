/**
 * Kids' kick-about on the halı saha: two small teams chase a ball, the nearest player
 * of each team goes for it, the rest hold loose positions. A shot that crosses the goal
 * mouth is a goal (the ball goes back to the centre spot).
 */
import { Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D } from "three"
import { NavGrid } from "@/app/nav-grid"
import { Pawn, type PawnLook } from "@/app/pawn"

interface Kid { pawn: Pawn; team: 0 | 1; home: Vector3; think: number }

const TEAMS: PawnLook[][] = [
  [
    { skin: "#e8c4a0", shirt: "#d8342c", pants: "#f2f2f2", hair: "#2a1d16" },
    { skin: "#c99a74", shirt: "#d8342c", pants: "#f2f2f2", hair: "#3b2a1f" },
    { skin: "#f0d2b6", shirt: "#d8342c", pants: "#f2f2f2", hair: "#b8863b" },
  ],
  [
    { skin: "#b07a52", shirt: "#f4d03f", pants: "#1d3557", hair: "#1b1410" },
    { skin: "#e8c4a0", shirt: "#f4d03f", pants: "#1d3557", hair: "#5a3a22" },
    { skin: "#d9b08c", shirt: "#f4d03f", pants: "#1d3557", hair: "#2a1d16" },
  ],
]

export class PitchGame {
  readonly group = new Group()
  private readonly kids: Kid[] = []
  private readonly nav: NavGrid
  private readonly ball: Mesh
  private readonly vel = new Vector3()
  private kickCool = 0
  /** Players walk back to their halves after a goal before play restarts. */
  private kickoff = 0
  private active = false

  constructor(
    scene: Object3D,
    private readonly centre: Vector3,
    private readonly halfL: number,
    private readonly halfW: number,
    private readonly mouth: number,
    private readonly y: number,
    private readonly rng: () => number,
    private readonly onGoal: (at: Vector3, team: 0 | 1) => void,
  ) {
    this.group.userData.excludeFromExport = true
    this.group.visible = false
    scene.add(this.group)
    this.nav = new NavGrid(centre.x - halfL - 0.5, centre.z - halfW - 0.5, centre.x + halfL + 0.5, centre.z + halfW + 0.5, 0.3)
    this.ball = new Mesh(new SphereGeometry(0.12, 14, 10), new MeshStandardMaterial({ color: "#f5f5f0", roughness: 0.5 }))
    this.ball.castShadow = true
    this.group.add(this.ball)
    TEAMS.forEach((looks, team) => looks.forEach((look, i) => {
      const pawn = new Pawn(look, 2.3 + rng() * 0.6)
      pawn.root.scale.setScalar(0.72)
      const dir = team === 0 ? -1 : 1
      const home = new Vector3(centre.x + dir * halfL * (0.25 + 0.3 * (i % 2)), 0, centre.z + (i - 1) * halfW * 0.55)
      pawn.root.position.copy(home).setY(y)
      this.group.add(pawn.root)
      this.kids.push({ pawn, team: team as 0 | 1, home, think: rng() * 0.4 })
    }))
    this.resetBall()
  }

  setActive(on: boolean) {
    this.active = on
    this.group.visible = on
  }

  private resetBall() {
    this.ball.position.set(this.centre.x, this.y + 0.12, this.centre.z)
    this.vel.set(0, 0, 0)
  }

  update(dt: number) {
    if (!this.active) return
    const b = this.ball.position
    // Ball: roll, slow down, bounce off the touchlines and the goal-line walls.
    b.addScaledVector(this.vel, dt)
    this.vel.multiplyScalar(Math.exp(-dt * 0.9))
    this.ball.rotation.x += (this.vel.z * dt) / 0.12
    this.ball.rotation.z -= (this.vel.x * dt) / 0.12
    const dz = b.z - this.centre.z
    if (Math.abs(dz) > this.halfW) { b.z = this.centre.z + Math.sign(dz) * this.halfW; this.vel.z *= -0.7 }
    const dx = b.x - this.centre.x
    if (Math.abs(dx) > this.halfL) {
      if (Math.abs(dz) < this.mouth) {
        this.onGoal(b.clone(), dx > 0 ? 0 : 1)
        this.resetBall()
        this.kickoff = 3
        for (const k of this.kids) k.pawn.goTo(this.nav, k.home.x, k.home.z)
      } else { b.x = this.centre.x + Math.sign(dx) * this.halfL; this.vel.x *= -0.7 }
    }

    // Players: the nearest of each team chases, the others drift with play.
    const chasers = [0, 1].map((t) => {
      let best: Kid | null = null
      let bd = Infinity
      for (const k of this.kids) {
        if (k.team !== t) continue
        const d = k.pawn.root.position.distanceTo(b)
        if (d < bd) { bd = d; best = k }
      }
      return best
    })
    this.kickCool -= dt
    if (this.kickoff > 0) {
      this.kickoff -= dt
      for (const k of this.kids) { k.pawn.update(dt); k.pawn.root.position.y = this.y }
      return
    }
    for (const k of this.kids) {
      k.think -= dt
      const p = k.pawn.root.position
      if (k.think <= 0) {
        k.think = 0.35 + this.rng() * 0.3
        const target = chasers.includes(k)
          ? b.clone()
          : k.home.clone().add(new Vector3((b.x - this.centre.x) * 0.5, 0, (b.z - this.centre.z) * 0.3))
        k.pawn.goTo(this.nav, target.x, target.z)
      }
      if (this.kickCool <= 0 && Math.hypot(p.x - b.x, p.z - b.z) < 0.5) {
        // Kick towards the other team's goal with some spray.
        const goalX = this.centre.x + (k.team === 0 ? this.halfL : -this.halfL)
        const aim = new Vector3(goalX - b.x, 0, this.centre.z + (this.rng() - 0.5) * this.mouth * 5 - b.z).normalize()
        // Mostly short passes and dribbles; now and then a real shot.
        const shot = Math.abs(goalX - b.x) < this.halfL * 0.6 && this.rng() < 0.35
        this.vel.copy(aim.multiplyScalar(shot ? 5 + this.rng() * 2.5 : 2 + this.rng() * 1.8))
        this.kickCool = 0.5
        k.pawn.faceTowards(b)
      }
      k.pawn.update(dt)
      p.y = this.y
    }
  }

  dispose() {
    this.kids.forEach((k) => k.pawn.dispose())
    this.ball.geometry.dispose()
    ;(this.ball.material as MeshStandardMaterial).dispose()
    this.group.removeFromParent()
  }
}
