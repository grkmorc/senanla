/**
 * Shared economy: money, reputation, the business you run (career tier), upgrades and
 * the shop-day clock.
 */
import type { Vector3 } from "three"
import { Upgrades } from "./upgrades"
import { tierById, type TierId } from "./career"

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
  money = 40
  reputation = 2.5
  day = 1
  tier: TierId = "cart"
  servedToday = 0
  revenueToday = 0
  private time = 0
  private readonly dayListeners: (() => void)[] = []
  private readonly tierListeners: ((t: TierId) => void)[] = []
  readonly upgrades = new Upgrades()

  constructor(readonly notify: Notifier) {}

  get stats() { return this.upgrades.stats }

  /** Buy the next level of an upgrade. Returns the new level, or null when it can't be bought. */
  buyUpgrade(id: string): number | null {
    const d = this.upgrades.def(id)
    const cost = this.upgrades.nextCost(id)
    if (!d || cost === null) return null
    if (this.money < cost) {
      this.notify.say(`Para yetmiyor · ${d.name} için ₺${cost} lazım`)
      return null
    }
    this.money -= cost
    const level = this.upgrades.raise(id)
    this.notify.say(`${d.name} · ${level}. seviye alındı`)
    return level
  }

  onTierChange(fn: (t: TierId) => void) { this.tierListeners.push(fn) }

  /** Move up to a new business. Returns false (and explains why) if it can't be done. */
  openTier(id: TierId): boolean {
    const t = tierById(id)
    if (!t.ready) { this.notify.say(`${t.name} yakında geliyor`); return false }
    if (this.money < t.cost) { this.notify.say(`Para yetmiyor · ${t.name} için ₺${t.cost.toLocaleString("tr-TR")} lazım`); return false }
    this.money -= t.cost
    this.setTier(id)
    return true
  }

  setTier(id: TierId) {
    this.tier = id
    this.upgrades.setTier(id)
    this.tierListeners.forEach((fn) => fn(id))
  }

  get dayProgress() { return this.time / DAY_SECONDS }
  /** True during the last in-game hour, when new customers stop arriving. */
  get closing() { return this.dayProgress > 0.92 }

  onNewDay(fn: () => void) { this.dayListeners.push(fn) }

  update(dt: number) {
    this.time += dt
    if (this.time >= DAY_SECONDS) {
      this.notify.say(`${this.day}. gün kapandı · ₺${this.revenueToday} kazanç, ${this.servedToday} müşteri`)
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
      this.notify.say(`Para yetmiyor · ${what} için ₺${amount} lazım`)
      return false
    }
    this.money -= amount
    this.notify.popup(at, `-₺${amount}`, "loss", where)
    return true
  }

  bumpRep(delta: number) {
    if (delta > 0) delta *= this.stats.repGainMult
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
