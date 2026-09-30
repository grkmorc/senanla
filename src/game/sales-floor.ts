/**
 * Walk-in shop floor (kiosk, grocery): customers browse stock units (shelves, fridges),
 * queue at the till and pay. Units run empty and the player restocks them. A helper
 * upgrade serves the queue automatically.
 */
import { Vector3, type Object3D } from "three"
import { Crowd, type CrowdDeps, type CrowdMember, type Mood } from "./crowd"
import type { Economy } from "./economy"

/** Anything with a 0..1 stock the shop can sell from. */
export interface StockModel {
  root: Object3D
  getConfig(): { stock: number }
  configure(patch: { stock: number }): unknown
}

export interface ShelfSlot {
  id: string
  label: string
  model: StockModel
  spot: Vector3
  price: number
}

interface Buyer extends CrowdMember {
  shelf: ShelfSlot | null
  timer: number
  basket: number
  bill: number
}

export interface FloorTuning {
  /** Level id used to tag floating labels. */
  where: string
  baseCustomers: number
  /** Seconds between customers at 0 reputation. */
  spawnBase: number
  patience: number
  /** Cost of refilling one empty unit. */
  restockFull: number
  /** Where a helper stands to serve (popups appear there). */
  till: Vector3
}

const PICK_AMOUNT = 0.12

export class SalesFloor {
  private readonly crowd: Crowd<Buyer>
  private spawnIn = 2
  private autoT = 0
  /** Only the business you run gets customers. */
  active = false

  constructor(private readonly eco: Economy, deps: CrowdDeps, private readonly shelves: ShelfSlot[], private readonly t: FloorTuning) {
    this.crowd = new Crowd<Buyer>(deps)
  }

  get queueLength() { return this.crowd.queue.length }
  /** Put a newly built unit into service. */
  addShelf(slot: ShelfSlot) { if (!this.shelves.includes(slot)) this.shelves.push(slot) }
  /** Units below a third full. */
  get lowShelves() { return this.shelves.filter((s) => s.model.getConfig().stock < 0.34).length }
  get customers() { return this.crowd.members.length }

  serve(at: Vector3, byHelper = false): boolean {
    const head = this.crowd.head()
    if (!head) {
      if (!byHelper) this.eco.notify.say(this.crowd.queue.length ? "Müşteri kasaya geliyor" : "Kasada bekleyen müşteri yok")
      return false
    }
    this.eco.earn(head.bill, at, this.t.where)
    this.eco.bumpRep(0.08)
    if (!byHelper) this.eco.notify.say(`Satış tamam · ${head.basket} ürün`)
    head.pawn.setCarry("#e8dcc4")
    this.crowd.leave(head)
    return true
  }

  restock(shelf: ShelfSlot, at: Vector3) {
    const stock = shelf.model.getConfig().stock
    if (stock >= 0.95) { this.eco.notify.say(`${shelf.label} zaten dolu`); return }
    const cost = Math.ceil((1 - stock) * this.t.restockFull * this.eco.stats.restockCostMult)
    if (!this.eco.spend(cost, at, "mal almak", this.t.where)) return
    shelf.model.configure({ stock: 1 })
    this.eco.notify.say(`${shelf.label} dolduruldu`)
  }

  update(dt: number) {
    const rng = this.crowd.d.rng
    if (this.active) {
      this.spawnIn -= dt
      const maxCustomers = this.t.baseCustomers + Math.ceil(this.shelves.length / 2) - 1
      if (!this.eco.closing && this.spawnIn <= 0 && this.crowd.members.length < maxCustomers) {
        this.spawn()
        this.spawnIn = (this.t.spawnBase - this.eco.reputation * 1.1 + rng() * 3) * this.eco.spawnScale
      }
      const every = this.eco.stats.autoServeEvery
      if (every > 0) {
        this.autoT += dt
        if (this.autoT >= every) { this.autoT = 0; this.serve(this.t.till, true) }
      }
    }
    for (const c of [...this.crowd.members]) this.think(c, dt)
    this.crowd.update(dt)
  }

  private spawn() {
    const c = this.crowd.spawn((pawn) => ({ pawn, state: "new", patience: 0, maxPatience: 1, shelf: null, timer: 0, basket: 0, bill: 0 }))
    const shelf = this.pickShelf(null)
    if (shelf) this.sendToShelf(c, shelf)
    else this.emptyHanded(c)
  }

  private think(c: Buyer, dt: number) {
    const rng = this.crowd.d.rng
    if (c.state === "browsing") {
      c.timer -= dt
      if (c.timer > 0) return
      const shelf = c.shelf!
      const stock = shelf.model.getConfig().stock
      if (stock >= PICK_AMOUNT * 0.5) {
        const n = 1 + Math.floor(rng() * 2)
        shelf.model.configure({ stock: Math.max(0, stock - PICK_AMOUNT * n) })
        c.basket += n
        c.bill += Math.round(n * shelf.price * this.eco.stats.priceMult)
        c.pawn.setCarry("#c8553d")
      }
      const next = rng() < 0.35 && c.basket < 3 ? this.pickShelf(shelf) : null
      if (next) this.sendToShelf(c, next)
      else if (c.basket > 0) this.crowd.joinQueue(c, this.t.patience * this.eco.stats.patienceMult)
      else this.emptyHanded(c)
    } else if (c.state === "queued" || c.state === "toQueue") {
      c.patience -= dt
      if (c.patience <= 0) {
        this.eco.notify.popup(c.pawn.root.position, "Çok bekledim!", "loss", this.t.where)
        this.eco.bumpRep(-0.3)
        this.crowd.leave(c)
      }
    }
  }

  private emptyHanded(c: Buyer) {
    this.eco.notify.popup(c.pawn.root.position, "Raflar boş", "loss", this.t.where)
    this.eco.bumpRep(-0.2)
    this.crowd.leave(c)
  }

  private pickShelf(except: ShelfSlot | null): ShelfSlot | null {
    const options = this.shelves.filter((s) => s !== except && s.model.getConfig().stock > 0.05)
    return options.length ? options[Math.floor(this.crowd.d.rng() * options.length)] : null
  }

  private sendToShelf(c: Buyer, shelf: ShelfSlot) {
    c.shelf = shelf
    const jitter = (this.crowd.d.rng() - 0.5) * 0.6
    const at = new Vector3(shelf.spot.x + jitter, 0, shelf.spot.z + jitter * 0.3)
    this.crowd.walkTo(c, at, "toShelf", () => {
      c.state = "browsing"
      c.timer = 1.5 + this.crowd.d.rng() * 2
      c.pawn.faceTowards(shelf.model.root.position)
    })
  }

  moods(): Mood[] {
    return this.crowd.queue.map((c) => ({ pawn: c.pawn, ratio: Math.max(0, c.patience / c.maxPatience), kind: "buyer" as const }))
  }

  /** Send everyone home (the business was closed). */
  clear() { for (const c of [...this.crowd.members]) this.crowd.remove(c) }

  dispose() { this.crowd.dispose() }
}
