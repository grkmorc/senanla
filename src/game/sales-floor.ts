/**
 * Sales floor: customers browse shelves, queue at the till, pay. Shelves run empty
 * and the player restocks them.
 */
import { Vector3 } from "three"
import type { ModularShelf } from "@/models/shop-kit/modular-shelf"
import { Crowd, type CrowdDeps, type CrowdMember, type Mood } from "./crowd"
import type { Economy } from "./economy"

export interface ShelfSlot {
  id: string
  label: string
  model: ModularShelf
  spot: Vector3
  price: number
}

interface Buyer extends CrowdMember {
  shelf: ShelfSlot | null
  timer: number
  basket: number
  bill: number
}

const MAX_CUSTOMERS = 5
const QUEUE_PATIENCE = 40
const RESTOCK_COST_FULL = 36
const PICK_AMOUNT = 0.12

export class SalesFloor {
  private readonly crowd: Crowd<Buyer>
  private spawnIn = 2

  constructor(private readonly eco: Economy, deps: CrowdDeps, private readonly shelves: ShelfSlot[]) {
    this.crowd = new Crowd<Buyer>(deps)
  }

  get queueLength() { return this.crowd.queue.length }

  serve(playerPos: Vector3) {
    const head = this.crowd.head()
    if (!head) {
      this.eco.notify.say(this.crowd.queue.length ? "Müşteri kasaya geliyor" : "Kasada bekleyen yok")
      return
    }
    this.eco.earn(head.bill, playerPos)
    this.eco.bumpRep(0.08)
    this.eco.notify.say(`Satış: ${head.basket} ürün`)
    head.pawn.setCarry("#e8dcc4")
    this.crowd.leave(head)
  }

  restock(shelf: ShelfSlot, playerPos: Vector3) {
    const stock = shelf.model.getConfig().stock
    if (stock >= 0.95) { this.eco.notify.say(`${shelf.label} zaten dolu`); return }
    const cost = Math.ceil((1 - stock) * RESTOCK_COST_FULL)
    if (!this.eco.spend(cost, playerPos, "raf doldurmak")) return
    shelf.model.configure({ stock: 1 })
    this.eco.notify.say(`${shelf.label} dolduruldu`)
  }

  update(dt: number) {
    const rng = this.crowd.d.rng
    this.spawnIn -= dt
    if (!this.eco.closing && this.spawnIn <= 0 && this.crowd.members.length < MAX_CUSTOMERS) {
      this.spawn()
      this.spawnIn = 11 - this.eco.reputation * 1.3 + rng() * 4
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
        c.bill += n * shelf.price
        c.pawn.setCarry("#c8553d")
      }
      const next = rng() < 0.35 && c.basket < 3 ? this.pickShelf(shelf) : null
      if (next) this.sendToShelf(c, next)
      else if (c.basket > 0) this.crowd.joinQueue(c, QUEUE_PATIENCE)
      else this.emptyHanded(c)
    } else if (c.state === "queued" || c.state === "toQueue") {
      c.patience -= dt
      if (c.patience <= 0) {
        this.eco.notify.popup(c.pawn.root.position, "Çok bekledim!", "loss")
        this.eco.bumpRep(-0.3)
        this.crowd.leave(c)
      }
    }
  }

  private emptyHanded(c: Buyer) {
    this.eco.notify.popup(c.pawn.root.position, "Raflar boş!", "loss")
    this.eco.bumpRep(-0.2)
    this.crowd.leave(c)
  }

  private pickShelf(except: ShelfSlot | null): ShelfSlot | null {
    const options = this.shelves.filter((s) => s !== except && s.model.getConfig().stock > 0.05)
    return options.length ? options[Math.floor(this.crowd.d.rng() * options.length)] : null
  }

  private sendToShelf(c: Buyer, shelf: ShelfSlot) {
    c.shelf = shelf
    const jitter = (this.crowd.d.rng() - 0.5) * 0.8
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

  dispose() { this.crowd.dispose() }
}
