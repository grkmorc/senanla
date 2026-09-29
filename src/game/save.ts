/**
 * Save game in this browser (localStorage). Everything is wrapped: private windows,
 * blocked storage or a corrupt save simply start a fresh game. v2 = career game.
 */
import type { Economy } from "./economy"
import { TIERS, type TierId } from "./career"

const KEY = "dukkan.save.v2"

interface SaveData {
  v: 2
  money: number
  reputation: number
  day: number
  tier: TierId
  upgrades: Record<string, number>
  savedAt: number
}

export function loadGame(eco: Economy): boolean {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) } catch { return false }
  if (!raw) return false
  try {
    const d = JSON.parse(raw) as Partial<SaveData>
    if (d.v !== 2) return false
    const num = (x: unknown, fallback: number) => (typeof x === "number" && Number.isFinite(x) ? x : fallback)
    eco.money = Math.max(0, Math.round(num(d.money, eco.money)))
    eco.reputation = Math.min(5, Math.max(0, num(d.reputation, eco.reputation)))
    eco.day = Math.max(1, Math.round(num(d.day, eco.day)))
    eco.upgrades.restore(d.upgrades ?? {})
    const tier = TIERS.find((t) => t.id === d.tier && t.ready)
    eco.setTier(tier ? tier.id : "cart")
    return true
  } catch {
    return false
  }
}

export function saveGame(eco: Economy) {
  const d: SaveData = {
    v: 2,
    money: eco.money,
    reputation: eco.reputation,
    day: eco.day,
    tier: eco.tier,
    upgrades: eco.upgrades.snapshot(),
    savedAt: Date.now(),
  }
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage unavailable: play without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
