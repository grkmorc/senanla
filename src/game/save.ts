/**
 * Save game in this browser (localStorage). Everything is wrapped: private windows,
 * blocked storage or a corrupt save simply start a fresh game.
 */
import type { Economy } from "./economy"

const KEY = "dukkan.save.v1"

interface SaveData {
  v: 1
  money: number
  reputation: number
  parts: number
  day: number
  upgrades: Record<string, number>
  savedAt: number
}

export function loadGame(eco: Economy): boolean {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) } catch { return false }
  if (!raw) return false
  try {
    const d = JSON.parse(raw) as Partial<SaveData>
    if (d.v !== 1) return false
    const num = (x: unknown, fallback: number) => (typeof x === "number" && Number.isFinite(x) ? x : fallback)
    eco.money = Math.max(0, Math.round(num(d.money, eco.money)))
    eco.reputation = Math.min(5, Math.max(0, num(d.reputation, eco.reputation)))
    eco.parts = Math.max(0, Math.round(num(d.parts, eco.parts)))
    eco.day = Math.max(1, Math.round(num(d.day, eco.day)))
    eco.upgrades.restore(d.upgrades ?? {})
    return true
  } catch {
    return false
  }
}

export function saveGame(eco: Economy) {
  const d: SaveData = {
    v: 1,
    money: eco.money,
    reputation: eco.reputation,
    parts: eco.parts,
    day: eco.day,
    upgrades: eco.upgrades.snapshot(),
    savedAt: Date.now(),
  }
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage unavailable: play without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
