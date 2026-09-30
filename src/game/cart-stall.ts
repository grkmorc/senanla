/**
 * Seyyar tezgâh: a simit cart on the sidewalk. Neighbours step out of the buildings, walk to
 * the cart and queue; you click the cart to sell, and buy new stock when the case runs low.
 * The cart model shows how full the case is; umbrella and tray follow the upgrades.
 */
import { Vector3 } from "three"
import type { StreetCart } from "@/models/shop-kit/street-cart"
import { Crowd, type CrowdDeps, type CrowdMember, type Mood } from "./crowd"
import type { Economy } from "./economy"

interface Walker extends CrowdMember {
  want: number
}

const ITEM_PRICE = 7
const UNIT_COST = 1.6
const PATIENCE = 20
const MAX_CROWD = 5

export class CartStall {
  private readonly crowd: Crowd<Walker>
  private spawnIn = 1.5
  private autoT = 0
  private shown = ""
  stock: number
  active = false

  constructor(
    private readonly eco: Economy,
    deps: CrowdDeps,
    private readonly cart: StreetCart,
    /** Doors and corners customers appear from. */
    private readonly origins: Vector3[],
  ) {
    this.crowd = new Crowd<Walker>(deps)
    this.stock = eco.stats.cartCapacity
    eco.upgrades.onChange(() => this.sync())
    this.sync()
  }

  get capacity() { return this.eco.stats.cartCapacity }
  get queueLength() { return this.crowd.queue.length }
  get at() { return this.cart.root.position }

  /** Sell to the first in line. */
  serve(byHelper = false): boolean {
    const head = this.crowd.head()
    if (!head) {
      if (!byHelper) this.eco.notify.say(this.crowd.queue.length ? "Müşteri geliyor" : "Tezgâhta bekleyen yok")
      return false
    }
    if (this.stock <= 0) {
      if (!byHelper) this.eco.notify.say("Tezgâh boş · kasadan mal al")
      return false
    }
    const qty = Math.min(this.stock, head.want)
    this.stock -= qty
    const bill = Math.round(qty * ITEM_PRICE * this.eco.stats.priceMult)
    this.eco.earn(bill, this.at, "outdoor")
    this.eco.bumpRep(0.05)
    if (!byHelper) this.eco.notify.say(`${qty} simit satıldı`)
    head.pawn.setCarry("#b8743a")
    this.crowd.leave(head)
    this.sync()
    return true
  }

  /** Refill the case from the crate. */
  restock() {
    const missing = this.capacity - this.stock
    if (missing <= 0) { this.eco.notify.say("Tezgâh zaten dolu"); return }
    const cost = Math.ceil(missing * UNIT_COST * this.eco.stats.restockCostMult)
    if (!this.eco.spend(cost, this.at, `${missing} simit`, "outdoor")) return
    this.stock = this.capacity
    this.eco.notify.say(`Tezgâh doldu · ${this.stock} simit`)
    this.sync()
  }

  get restockCost() {
    return Math.ceil(Math.max(0, this.capacity - this.stock) * UNIT_COST * this.eco.stats.restockCostMult)
  }

  update(dt: number) {
    const rng = this.crowd.d.rng
    if (this.active) {
      this.spawnIn -= dt
      if (!this.eco.closing && this.spawnIn <= 0 && this.crowd.members.length < MAX_CROWD) {
        this.crowd.d.entrance.copy(this.origins[Math.floor(rng() * this.origins.length)])
        const c = this.crowd.spawn((pawn) => ({ pawn, state: "new", patience: 0, maxPatience: 1, want: 1 + Math.floor(rng() * 3) }))
        this.crowd.joinQueue(c, PATIENCE * this.eco.stats.patienceMult)
        this.spawnIn = (7.5 - this.eco.reputation * 0.7 + rng() * 2.5) * this.eco.spawnScale
      }
      const every = this.eco.stats.autoServeEvery
      if (every > 0) {
        this.autoT += dt
        if (this.autoT >= every) { this.autoT = 0; this.serve(true) }
      }
    }
    for (const c of [...this.crowd.members]) {
      if (c.state !== "queued") continue
      c.patience -= dt
      if (c.patience > 0) continue
      this.eco.notify.popup(c.pawn.root.position, this.stock <= 0 ? "Simit kalmamış" : "Çok bekledim!", "loss", "outdoor")
      this.eco.bumpRep(-0.25)
      this.crowd.leave(c)
    }
    this.crowd.update(dt)
  }

  /** Keep the cart model in step with stock and upgrades (rebuild only on change). */
  private sync() {
    this.stock = Math.min(this.stock, this.capacity)
    const s = this.eco.stats
    const stock = Math.round((this.stock / this.capacity) * 20) / 20
    const key = `${stock}|${s.cartTray}|${s.cartUmbrella}`
    if (key === this.shown) return
    this.shown = key
    this.cart.configure({ stock, tray: s.cartTray, umbrella: s.cartUmbrella })
  }

  moods(): Mood[] {
    return this.crowd.queue.map((c) => ({ pawn: c.pawn, ratio: Math.max(0, c.patience / c.maxPatience), kind: "buyer" as const }))
  }

  /** Close the stall: everyone goes home. */
  clear() { for (const c of [...this.crowd.members]) this.crowd.remove(c) }

  dispose() { this.crowd.dispose() }
}
