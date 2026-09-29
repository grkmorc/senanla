/**
 * Shop game loop: customers, queue at the checkout, shelf stock, repair jobs, economy.
 * Pure game state + customer AI; rendering is done by the scene through the deps below.
 */
import { Vector3, type Object3D } from "three"
import type { NavGrid } from "@/app/nav-grid"
import { Pawn, CUSTOMER_LOOKS } from "@/app/pawn"
import type { ModularShelf } from "@/models/shop-kit/modular-shelf"

export interface ShelfSlot {
  id: string
  label: string
  model: ModularShelf
  /** World position the customer stands on while browsing. */
  spot: Vector3
  /** Sale price per item. */
  price: number
}

export interface GameDeps {
  scene: Object3D
  nav: NavGrid
  shelves: ShelfSlot[]
  /** Where the first customer in line stands. */
  queueHead: Vector3
  /** Direction the queue grows in, one step per customer. */
  queueStep: Vector3
  /** Repair customers wait here while you work. */
  waitingSpot: Vector3
  entrance: Vector3
  say(msg: string): void
  popup(at: Vector3, text: string, tone: "gain" | "loss" | "info"): void
  onLamp(on: boolean): void
}

type CustomerState =
  | "toShelf" | "browsing" | "toQueue" | "queued" | "toWaiting" | "waiting" | "leaving"

interface Customer {
  pawn: Pawn
  kind: "buyer" | "repair"
  state: CustomerState
  timer: number
  patience: number
  shelf: ShelfSlot | null
  basket: number
  /** Price owed at the till. */
  bill: number
}

export type Carry = null | "broken" | "fixed"

export interface HudState {
  money: number
  reputation: number
  day: number
  clock: string
  dayProgress: number
  queue: number
  customers: number
  carry: Carry
  repairProgress: number | null
  servedToday: number
  revenueToday: number
}

const DAY_SECONDS = 180
const OPEN_H = 8
const CLOSE_H = 20
const MAX_CUSTOMERS = 5
const QUEUE_PATIENCE = 40
const REPAIR_PATIENCE = 110
const REPAIR_TIME = 4
const REPAIR_FEE = 45
const RESTOCK_COST_FULL = 36
const PICK_AMOUNT = 0.12


export class ShopGame {
  money = 150
  reputation = 3
  day = 1
  carry: Carry = null
  private time = 0
  private spawnIn = 2
  private customers: Customer[] = []
  private queue: Customer[] = []
  private repairJob: { customer: Customer; progress: number } | null = null
  private benchActive = false
  private servedToday = 0
  private revenueToday = 0
  private rng = mulberry32(20260929)

  constructor(private readonly d: GameDeps) {}

  // ------------------------------------------------------------ player actions

  /** Player reached the cashier spot and clicked the counter. */
  serveAtCounter(playerPos: Vector3): void {
    if (this.carry === "fixed" && this.repairJob) {
      const c = this.repairJob.customer
      this.repairJob = null
      this.carry = null
      this.earn(REPAIR_FEE, playerPos)
      this.bumpRep(0.25)
      this.d.say("Tamir teslim edildi")
      this.leave(c)
      return
    }
    const head = this.queue[0]
    if (!head || head.state !== "queued") {
      this.d.say(this.queue.length ? "Müşteri sıraya geliyor" : "Kasada bekleyen yok")
      return
    }
    if (head.kind === "repair") {
      if (this.carry || this.repairJob) {
        this.d.say("Önce elindeki tamir işini bitir")
        return
      }
      this.queue.shift()
      this.carry = "broken"
      this.repairJob = { customer: head, progress: 0 }
      head.pawn.setCarry(null)
      head.state = "toWaiting"
      head.patience = REPAIR_PATIENCE
      head.pawn.goTo(this.d.nav, this.d.waitingSpot.x, this.d.waitingSpot.z, () => { head.state = "waiting" })
      this.d.say("Arızalı cihazı aldın. Tamir masasına götür")
      this.reflowQueue()
      return
    }
    this.queue.shift()
    this.earn(head.bill, playerPos)
    this.bumpRep(0.07)
    this.servedToday++
    this.d.say(`Satış: ${head.basket} ürün`)
    head.pawn.setCarry("#e8dcc4")
    this.leave(head)
    this.reflowQueue()
  }

  /** Player reached the bench. Returns true when the bench is now repairing. */
  useBench(): boolean {
    if (this.carry === "broken" && this.repairJob) {
      this.benchActive = true
      this.d.onLamp(true)
      this.d.say("Tamir ediliyor…")
      return true
    }
    if (this.carry === "fixed") { this.d.say("Cihaz hazır. Kasadan teslim et"); return false }
    return false
  }

  /** Player walked away from the bench. */
  leaveBench() { this.benchActive = false }

  restock(shelf: ShelfSlot, playerPos: Vector3): void {
    const stock = shelf.model.getConfig().stock
    if (stock >= 0.95) { this.d.say(`${shelf.label} zaten dolu`); return }
    const cost = Math.ceil((1 - stock) * RESTOCK_COST_FULL)
    if (this.money < cost) { this.d.say(`Yetersiz para: ₺${cost} gerekli`); return }
    this.money -= cost
    shelf.model.configure({ stock: 1 })
    this.d.popup(playerPos, `-₺${cost}`, "loss")
    this.d.say(`${shelf.label} dolduruldu`)
  }

  // ------------------------------------------------------------ simulation

  update(dt: number, playerMoving: boolean): void {
    this.time += dt
    if (this.time >= DAY_SECONDS) this.endDay()

    // Spawning: better reputation brings customers faster.
    const open = this.time < DAY_SECONDS * 0.92
    this.spawnIn -= dt
    if (open && this.spawnIn <= 0 && this.customers.length < MAX_CUSTOMERS) {
      this.spawn()
      this.spawnIn = 11 - this.reputation * 1.3 + this.rng() * 4
    }

    // Repair progress only while the player stands at the bench.
    if (this.benchActive && this.repairJob && this.carry === "broken") {
      if (playerMoving) this.benchActive = false
      else {
        this.repairJob.progress += dt / REPAIR_TIME
        if (this.repairJob.progress >= 1) {
          this.repairJob.progress = 1
          this.carry = "fixed"
          this.benchActive = false
          this.d.onLamp(false)
          this.d.say("Tamir bitti. Kasada teslim et")
        }
      }
    }

    for (const c of [...this.customers]) this.think(c, dt)
    for (const c of this.customers) c.pawn.update(dt)
  }

  private think(c: Customer, dt: number) {
    switch (c.state) {
      case "browsing":
        c.timer -= dt
        if (c.timer <= 0) {
          const shelf = c.shelf!
          const stock = shelf.model.getConfig().stock
          if (stock >= PICK_AMOUNT * 0.5) {
            const n = 1 + Math.floor(this.rng() * 2)
            shelf.model.configure({ stock: Math.max(0, stock - PICK_AMOUNT * n) })
            c.basket += n
            c.bill += n * shelf.price
            c.pawn.setCarry("#c8553d")
          }
          const next = this.rng() < 0.35 && c.basket < 3 ? this.pickShelf(shelf) : null
          if (next) this.sendToShelf(c, next)
          else if (c.basket > 0) this.joinQueue(c)
          else {
            this.d.popup(c.pawn.root.position, "Raflar boş!", "loss")
            this.bumpRep(-0.3)
            this.leave(c)
          }
        }
        break
      case "queued":
      case "toQueue":
        c.patience -= dt
        if (c.patience <= 0) {
          this.d.popup(c.pawn.root.position, "Çok bekledim!", "loss")
          this.bumpRep(-0.5)
          this.queue = this.queue.filter((q) => q !== c)
          this.reflowQueue()
          this.leave(c)
        }
        break
      case "waiting":
      case "toWaiting":
        c.patience -= dt
        if (c.patience <= 0 && this.repairJob?.customer === c) {
          this.d.popup(c.pawn.root.position, "Cihazımı geri ver!", "loss")
          this.bumpRep(-0.8)
          this.repairJob = null
          this.carry = null
          this.benchActive = false
          this.d.onLamp(false)
          this.leave(c)
        }
        break
    }
  }

  private spawn() {
    const repair = !this.repairJob && !this.queue.some((q) => q.kind === "repair") && this.rng() < 0.28
    const look = CUSTOMER_LOOKS[Math.floor(this.rng() * CUSTOMER_LOOKS.length)]
    const pawn = new Pawn(look, 1.7 + this.rng() * 0.5)
    pawn.root.position.copy(this.d.entrance)
    pawn.root.rotation.y = Math.PI
    this.d.scene.add(pawn.root)
    const c: Customer = {
      pawn, kind: repair ? "repair" : "buyer", state: "toShelf", timer: 0,
      patience: QUEUE_PATIENCE, shelf: null, basket: 0, bill: 0,
    }
    this.customers.push(c)
    if (repair) {
      pawn.setCarry("#e0822c")
      this.joinQueue(c)
      return
    }
    const shelf = this.pickShelf(null)
    if (shelf) this.sendToShelf(c, shelf)
    else {
      this.d.popup(this.d.entrance, "Raflar boş!", "loss")
      this.bumpRep(-0.3)
      this.leave(c)
    }
  }

  private pickShelf(except: ShelfSlot | null): ShelfSlot | null {
    const options = this.d.shelves.filter((s) => s !== except && s.model.getConfig().stock > 0.05)
    return options.length ? options[Math.floor(this.rng() * options.length)] : null
  }

  private sendToShelf(c: Customer, shelf: ShelfSlot) {
    c.shelf = shelf
    c.state = "toShelf"
    const jitter = (this.rng() - 0.5) * 0.8
    const ok = c.pawn.goTo(this.d.nav, shelf.spot.x + jitter, shelf.spot.z + jitter * 0.3, () => {
      c.state = "browsing"
      c.timer = 1.5 + this.rng() * 2
      c.pawn.faceTowards(shelf.model.root.position)
    })
    if (!ok) this.leave(c)
  }

  private joinQueue(c: Customer) {
    c.state = "toQueue"
    c.patience = QUEUE_PATIENCE
    this.queue.push(c)
    this.reflowQueue()
  }

  /** Walk every queued customer to their slot; first in line faces the counter. */
  private reflowQueue() {
    this.queue.forEach((c, i) => {
      const slot = this.d.queueHead.clone().addScaledVector(this.d.queueStep, i)
      const dest = c.pawn.destination
      const standing = !c.pawn.moving && c.pawn.root.position.distanceTo(slot) < 0.05
      if (standing || (dest && dest.distanceTo(slot) < 0.05)) return
      c.state = "toQueue"
      c.pawn.goTo(this.d.nav, slot.x, slot.z, () => {
        c.state = "queued"
        c.pawn.faceTowards(this.d.queueHead.clone().add(new Vector3(0, 0, -1)))
      })
    })
  }

  private leave(c: Customer) {
    c.state = "leaving"
    const done = () => this.remove(c)
    if (!c.pawn.goTo(this.d.nav, this.d.entrance.x, this.d.entrance.z + 0.3, done)) done()
  }

  private remove(c: Customer) {
    c.pawn.dispose()
    this.customers = this.customers.filter((x) => x !== c)
    this.queue = this.queue.filter((x) => x !== c)
  }

  private earn(amount: number, at: Vector3) {
    this.money += amount
    this.revenueToday += amount
    this.d.popup(at, `+₺${amount}`, "gain")
  }

  private bumpRep(delta: number) {
    this.reputation = Math.min(5, Math.max(0, this.reputation + delta))
  }

  private endDay() {
    this.d.say(`${this.day}. gün bitti: ₺${this.revenueToday} kazanç, ${this.servedToday} satış`)
    this.day++
    this.time = 0
    this.servedToday = 0
    this.revenueToday = 0
  }

  /** Customers whose patience is ticking, for over-head indicators. */
  moods(): { pawn: Pawn; ratio: number; kind: "buyer" | "repair" }[] {
    return this.customers
      .filter((c) => c.state === "queued" || c.state === "waiting" || c.state === "toWaiting")
      .map((c) => ({
        pawn: c.pawn,
        ratio: Math.max(0, c.patience / (c.state === "queued" ? QUEUE_PATIENCE : REPAIR_PATIENCE)),
        kind: c.kind,
      }))
  }

  hud(): HudState {
    const t = this.time / DAY_SECONDS
    const hours = OPEN_H + t * (CLOSE_H - OPEN_H)
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60 / 10) * 10
    return {
      money: this.money,
      reputation: this.reputation,
      day: this.day,
      clock: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      dayProgress: t,
      queue: this.queue.length,
      customers: this.customers.length,
      carry: this.carry,
      repairProgress: this.repairJob && this.carry === "broken" ? this.repairJob.progress : null,
      servedToday: this.servedToday,
      revenueToday: this.revenueToday,
    }
  }

  dispose() {
    this.customers.forEach((c) => c.pawn.dispose())
    this.customers = []
    this.queue = []
  }
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
