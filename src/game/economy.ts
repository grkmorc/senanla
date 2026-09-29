/**
 * Shared economy across all three shops: money, reputation, spare parts,
 * what the player is carrying, and the shop-day clock.
 */
import type { Vector3 } from "three"

export type Carry = null | "broken" | "fixed"
export type Tone = "gain" | "loss" | "info"

export interface Notifier {
  say(msg: string): void
  /** `where` names the level the event happened in (a LevelId). */
  popup(at: Vector3, text: string, tone: Tone, where: string): void
}

export const DAY_SECONDS = 180
export const OPEN_H = 8
export const CLOSE_H = 20

export class Economy {
  money = 150
  reputation = 3
  parts = 2
  day = 1
  carry: Carry = null
  servedToday = 0
  revenueToday = 0
  private time = 0
  private readonly dayListeners: (() => void)[] = []

  constructor(readonly notify: Notifier) {}

  get dayProgress() { return this.time / DAY_SECONDS }
  /** True during the last few in-game hours, when new customers stop arriving. */
  get closing() { return this.dayProgress > 0.92 }

  onNewDay(fn: () => void) { this.dayListeners.push(fn) }

  update(dt: number) {
    this.time += dt
    if (this.time >= DAY_SECONDS) {
      this.notify.say(`${this.day}. gün bitti: ₺${this.revenueToday} kazanç, ${this.servedToday} müşteri`)
      this.day++
      this.time = 0
      this.servedToday = 0
      this.revenueToday = 0
      this.dayListeners.forEach((fn) => fn())
    }
  }

  earn(amount: number, at: Vector3, where: string) {
    this.money += amount
    this.revenueToday += amount
    this.servedToday++
    this.notify.popup(at, `+₺${amount}`, "gain", where)
  }

  /** Returns false (and explains why) when the player can't afford it. */
  spend(amount: number, at: Vector3, what: string, where: string): boolean {
    if (this.money < amount) {
      this.notify.say(`Yetersiz para: ${what} için ₺${amount} gerekli`)
      return false
    }
    this.money -= amount
    this.notify.popup(at, `-₺${amount}`, "loss", where)
    return true
  }

  bumpRep(delta: number) {
    this.reputation = Math.min(5, Math.max(0, this.reputation + delta))
  }

  clock(): string {
    const hours = OPEN_H + this.dayProgress * (CLOSE_H - OPEN_H)
    const h = Math.floor(hours)
    const m = Math.floor(((hours - h) * 60) / 10) * 10
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }

  /** Hours as a float, e.g. 13.5 for 13:30. */
  hours() { return OPEN_H + this.dayProgress * (CLOSE_H - OPEN_H) }
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
