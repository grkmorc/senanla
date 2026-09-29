/**
 * Scrapyard: strip salvage piles for spare parts (takes time, free) or buy parts at the
 * dealer's desk (instant, costs money). Piles slowly refill.
 */
import type { Vector3 } from "three"
import type { ScrapPile } from "@/models/shop-kit/scrap-pile"
import { mulberry32, type Economy } from "./economy"

export interface PileSlot {
  id: string
  model: ScrapPile
  spot: Vector3
  /** Parts left before the pile is stripped bare. */
  left: number
}

export const PILE_MAX = 4
const REFILL_EVERY = 25

export class ScrapYard {
  private active: PileSlot | null = null
  private progress = 0
  private refillIn = REFILL_EVERY
  private readonly rng = mulberry32(3003)

  constructor(private readonly eco: Economy, readonly piles: PileSlot[]) {
    for (const p of piles) this.syncPile(p)
    eco.onNewDay(() => { for (const p of piles) { p.left = PILE_MAX; this.syncPile(p) } })
  }

  get workProgress(): number | null { return this.active ? this.progress : null }
  get partPrice() { return this.eco.stats.partPrice }
  /** Parts still recoverable from all piles. */
  get salvageLeft() { return this.piles.reduce((n, p) => n + p.left, 0) }

  strip(pile: PileSlot) {
    if (pile.left <= 0) { this.eco.notify.say("Bu yığında parça kalmadı"); return }
    this.active = pile
    this.progress = 0
    this.eco.notify.say("Hurda sökülüyor…")
  }

  buyPart(at: Vector3) {
    if (!this.eco.spend(this.eco.stats.partPrice, at, "yedek parça", "scrap")) return
    this.eco.parts++
    this.eco.notify.say(`Parça alındı · elinde ${this.eco.parts}`)
  }

  update(dt: number, playerMoving: boolean) {
    if (this.active) {
      if (playerMoving) { this.active = null; this.progress = 0 }
      else {
        this.progress += dt / this.eco.stats.stripTime
        if (this.progress >= 1) {
          const p = this.active
          this.active = null
          this.progress = 0
          p.left--
          this.syncPile(p)
          const bonus = this.rng() < this.eco.stats.bonusPartChance ? 1 : 0
          this.eco.parts += 1 + bonus
          this.eco.notify.popup(p.spot, bonus ? "+2 parça" : "+1 parça", "info", "scrap")
          this.eco.notify.say(`Parça çıkarıldı · elinde ${this.eco.parts}`)
        }
      }
    }
    this.refillIn -= dt
    if (this.refillIn <= 0) {
      this.refillIn = REFILL_EVERY
      const low = this.piles.filter((p) => p.left < PILE_MAX).sort((a, b) => a.left - b.left)[0]
      if (low) { low.left++; this.syncPile(low) }
    }
  }

  private syncPile(p: PileSlot) {
    const amount = Math.max(0.12, p.left / PILE_MAX)
    if (Math.abs(p.model.getConfig().amount - amount) > 1e-3) p.model.configure({ amount })
  }
}
