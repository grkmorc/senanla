/**
 * Scrapyard: strip salvage piles for spare parts (takes time, free) or buy parts at the
 * dealer's desk (instant, costs money). Piles slowly refill.
 */
import type { Vector3 } from "three"
import type { ScrapPile } from "@/models/shop-kit/scrap-pile"
import type { Economy } from "./economy"

export interface PileSlot {
  id: string
  model: ScrapPile
  spot: Vector3
  /** Parts left before the pile is stripped bare. */
  left: number
}

export const PILE_MAX = 4
export const STRIP_TIME = 2.5
const PART_PRICE = 14
const REFILL_EVERY = 25

export class ScrapYard {
  private active: PileSlot | null = null
  private progress = 0
  private refillIn = REFILL_EVERY

  constructor(private readonly eco: Economy, readonly piles: PileSlot[]) {
    for (const p of piles) this.syncPile(p)
    eco.onNewDay(() => { for (const p of piles) { p.left = PILE_MAX; this.syncPile(p) } })
  }

  get workProgress(): number | null { return this.active ? this.progress : null }
  get partPrice() { return PART_PRICE }

  strip(pile: PileSlot) {
    if (pile.left <= 0) { this.eco.notify.say("Bu yığında işe yarar parça kalmadı"); return }
    this.active = pile
    this.progress = 0
    this.eco.notify.say("Hurda sökülüyor…")
  }

  buyPart(at: Vector3) {
    if (!this.eco.spend(PART_PRICE, at, "yedek parça", "scrap")) return
    this.eco.parts++
    this.eco.notify.say(`Parça alındı (${this.eco.parts} parça)`)
  }

  update(dt: number, playerMoving: boolean) {
    if (this.active) {
      if (playerMoving) { this.active = null; this.progress = 0 }
      else {
        this.progress += dt / STRIP_TIME
        if (this.progress >= 1) {
          const p = this.active
          this.active = null
          this.progress = 0
          p.left--
          this.syncPile(p)
          this.eco.parts++
          this.eco.notify.popup(p.spot, "+1 parça", "info", "scrap")
          this.eco.notify.say(`Parça çıkarıldı (${this.eco.parts} parça)`)
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
