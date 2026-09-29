/**
 * Repair desk: customers queue with a broken device. Take it at the desk, fix it at a
 * bench (costs one spare part from the scrapyard), hand it back at the desk.
 */
import { Vector3 } from "three"
import { Crowd, type CrowdDeps, type CrowdMember, type Mood } from "./crowd"
import type { Economy } from "./economy"

interface Client extends CrowdMember {
  /** Where they sit while the device is being fixed. */
  seat: number
}

const MAX_CLIENTS = 4
const QUEUE_PATIENCE = 45
const WAIT_PATIENCE = 130
export const REPAIR_TIME = 4
const REPAIR_FEE = 55

export class RepairDesk {
  private readonly crowd: Crowd<Client>
  private spawnIn = 6
  /** The client whose device the player is holding or has fixed. */
  private job: Client | null = null
  private benchActive = false
  private progress = 0

  constructor(
    private readonly eco: Economy,
    deps: CrowdDeps,
    private readonly seats: Vector3[],
    private readonly onLamp: (on: boolean) => void,
  ) {
    this.crowd = new Crowd<Client>(deps)
  }

  get queueLength() { return this.crowd.queue.length }
  get repairProgress(): number | null { return this.eco.carry === "broken" && this.progress > 0 ? this.progress : null }

  /** Player at the reception desk. */
  serve(playerPos: Vector3) {
    if (this.eco.carry === "fixed" && this.job) {
      const c = this.job
      this.job = null
      this.eco.carry = null
      this.eco.earn(REPAIR_FEE, playerPos)
      this.eco.bumpRep(0.3)
      this.eco.notify.say("Cihaz teslim edildi")
      c.pawn.setCarry("#6fcf7c")
      this.crowd.leave(c)
      return
    }
    if (this.eco.carry === "broken") { this.eco.notify.say("Önce elindeki cihazı onar"); return }
    const head = this.crowd.head()
    if (!head) {
      this.eco.notify.say(this.crowd.queue.length ? "Müşteri masaya geliyor" : "Tamir bekleyen yok")
      return
    }
    this.crowd.dequeue(head)
    this.job = head
    this.progress = 0
    this.eco.carry = "broken"
    head.pawn.setCarry(null)
    head.patience = head.maxPatience = WAIT_PATIENCE
    head.seat = this.freeSeat()
    this.crowd.walkTo(head, this.seats[head.seat], "toSeat", () => {
      head.state = "waiting"
      head.pawn.faceTowards(this.crowd.d.queueHead)
    })
    this.eco.notify.say(this.eco.parts > 0 ? "Cihazı aldın. Tamir masasına götür" : "Cihazı aldın ama parçan yok: hurdalıktan getir")
  }

  /** Player at a bench. Returns true when work started. */
  useBench(): boolean {
    if (this.eco.carry !== "broken" || !this.job) return false
    if (this.progress === 0) {
      if (this.eco.parts <= 0) { this.eco.notify.say("Yedek parça yok! Hurdalıktan parça getir"); return false }
      this.eco.parts--
    }
    this.benchActive = true
    this.onLamp(true)
    this.eco.notify.say("Tamir ediliyor…")
    return true
  }

  update(dt: number, playerMoving: boolean) {
    const rng = this.crowd.d.rng
    this.spawnIn -= dt
    if (!this.eco.closing && this.spawnIn <= 0 && this.crowd.members.length < MAX_CLIENTS) {
      const c = this.crowd.spawn((pawn) => ({ pawn, state: "new", patience: 0, maxPatience: 1, seat: -1 }))
      c.pawn.setCarry("#e0822c")
      this.crowd.joinQueue(c, QUEUE_PATIENCE)
      this.spawnIn = 22 - this.eco.reputation * 2 + rng() * 8
    }

    if (this.benchActive) {
      if (playerMoving || this.eco.carry !== "broken") this.benchActive = false
      else {
        this.progress = Math.min(1, this.progress + dt / REPAIR_TIME)
        if (this.progress >= 1) {
          this.eco.carry = "fixed"
          this.benchActive = false
          this.progress = 0
          this.onLamp(false)
          this.eco.notify.say("Tamir bitti. Masada müşteriye teslim et")
        }
      }
    }

    for (const c of [...this.crowd.members]) {
      if (c.state === "leaving" || c.state === "new") continue
      c.patience -= dt
      if (c.patience > 0) continue
      this.eco.notify.popup(c.pawn.root.position, c === this.job ? "Cihazımı geri ver!" : "Çok bekledim!", "loss")
      this.eco.bumpRep(c === this.job ? -0.6 : -0.3)
      if (c === this.job) {
        this.job = null
        this.eco.carry = null
        this.benchActive = false
        this.progress = 0
        this.onLamp(false)
      }
      this.crowd.leave(c)
    }
    this.crowd.update(dt)
  }

  private freeSeat(): number {
    const taken = new Set(this.crowd.members.map((m) => m.seat))
    for (let i = 0; i < this.seats.length; i++) if (!taken.has(i)) return i
    return 0
  }

  moods(): Mood[] {
    return this.crowd.members
      .filter((c) => c.state === "queued" || c.state === "toQueue" || c.state === "waiting" || c.state === "toSeat")
      .map((c) => ({ pawn: c.pawn, ratio: Math.max(0, c.patience / c.maxPatience), kind: "repair" as const }))
  }

  dispose() { this.crowd.dispose() }
}
