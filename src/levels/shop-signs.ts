/**
 * Who lives on the street: sign styles for the neighbours' shops and for the buildings of
 * your career ladder. Every shop has a painted board over its door and a big LED box on
 * its roof (lit day and night) so the street reads from any zoom.
 */
import type { SignStyle } from "@/app/signage"
import { tierById, tierIndex, type TierId } from "@/game/career"

export type NeighbourShop =
  | "berber" | "firin" | "eczane" | "kasap" | "kirtasiye" | "kahvehane" | "terzi" | "cicekci" | "kafe"
  | "doner" | "kuafor" | "nalbur" | "optik" | "banka" | "pide" | "fotograf" | "kuru" | "pastane" | "otel"
  | "spor" | "market" | "cay"

interface ShopIdentity { board: SignStyle; led: string }

const S: Record<NeighbourShop, ShopIdentity> = {
  berber: { board: { text: "Berber", sub: "Saç · Sakal · Tıraş", bg: "#1d3557", fg: "#f1faee", accent: "#e63946", icon: "pole" }, led: "#ff5a6a" },
  firin: { board: { text: "Fırın", sub: "Ekmek · Pide · Poğaça", bg: "#7a4a22", fg: "#ffe3b3", accent: "#f2a541", icon: "bread" }, led: "#ffb347" },
  eczane: { board: { text: "Eczane", sub: "Sağlıklı günler", bg: "#f7f4ef", fg: "#c62828", accent: "#c62828", icon: "cross" }, led: "#ff3b3b" },
  kasap: { board: { text: "Kasap", sub: "Et · Tavuk · Sucuk", bg: "#8e1f1f", fg: "#fff4ec", accent: "#f0c9a0", icon: "knife" }, led: "#ff6b4a" },
  kirtasiye: { board: { text: "Kırtasiye", sub: "Defter · Kalem · Fotokopi", bg: "#2a6fb0", fg: "#ffffff", accent: "#ffd166", icon: "pencil" }, led: "#4fc3ff" },
  kahvehane: { board: { text: "Kahvehane", sub: "Çay · Kahve · Okey", bg: "#3b2a20", fg: "#f3c77a", accent: "#c0392b", icon: "cup" }, led: "#ffc861" },
  terzi: { board: { text: "Terzi", sub: "Tadilat · Paça · Fermuar", bg: "#4b3563", fg: "#f4ecff", accent: "#d4a5ff", icon: "needle" }, led: "#c792ff" },
  cicekci: { board: { text: "Çiçekçi", sub: "Buket · Saksı · Çelenk", bg: "#f5d6e0", fg: "#7a1f45", accent: "#3f8f4f", icon: "flower" }, led: "#ff7ab8" },
  kafe: { board: { text: "Köşe Kafe", sub: "Kahve · Tost · Tatlı", bg: "#244d43", fg: "#f6efe2", accent: "#e9b872", icon: "cup" }, led: "#5fe3b0" },
  doner: { board: { text: "Dönerci", sub: "Et · Tavuk · Dürüm", bg: "#b8401f", fg: "#fff3dc", accent: "#ffd166", icon: "knife" }, led: "#ff8c3a" },
  kuafor: { board: { text: "Kuaför", sub: "Kesim · Boya · Fön", bg: "#f3dfe8", fg: "#8a2c5c", accent: "#8a2c5c", icon: "pole" }, led: "#ff6fd8" },
  nalbur: { board: { text: "Nalbur", sub: "Hırdavat · Boya · Elektrik", bg: "#394a2a", fg: "#f0f0d8", accent: "#e3b23c", icon: "helmet" }, led: "#b6ff5c" },
  optik: { board: { text: "Optik", sub: "Gözlük · Lens", bg: "#e8eef4", fg: "#1f3b57", accent: "#1f3b57", icon: "glasses" }, led: "#6ec8ff" },
  banka: { board: { text: "Mahalle Bankası", sub: "ATM 7/24", bg: "#113a33", fg: "#e7f5ef", accent: "#3fb3a3", icon: "bank" }, led: "#3fe0c0" },
  pide: { board: { text: "Pide Salonu", sub: "Kıymalı · Kaşarlı · Lahmacun", bg: "#6b2a1a", fg: "#ffe6c7", accent: "#f2a541", icon: "pot" }, led: "#ff9f43" },
  fotograf: { board: { text: "Fotoğrafçı", sub: "Vesikalık 10 dk", bg: "#262626", fg: "#f2f2f2", accent: "#e0634e", icon: "camera" }, led: "#ffffff" },
  kuru: { board: { text: "Kuru Temizleme", sub: "Ütü · Leke · Halı", bg: "#e6f1f7", fg: "#1d4e6b", accent: "#1d4e6b", icon: "needle" }, led: "#7fd6ff" },
  pastane: { board: { text: "Pastane", sub: "Pasta · Börek · Kurabiye", bg: "#fbe3ea", fg: "#8a3050", accent: "#8a3050", icon: "cake" }, led: "#ff8fb1" },
  otel: { board: { text: "Otel Mahalle", sub: "Oda · Kahvaltı", bg: "#1f2238", fg: "#f3e6c4", accent: "#d9b35b", icon: "bed" }, led: "#ffd479" },
  spor: { board: { text: "Spor Salonu", sub: "Fitness · Pilates", bg: "#141414", fg: "#f2f2f2", accent: "#e63946", icon: "dumbbell" }, led: "#ff4040" },
  market: { board: { text: "Mini Market", sub: "7/24 açık", bg: "#1f5aa6", fg: "#ffffff", accent: "#ffd166", icon: "cart" }, led: "#5aa9ff" },
  cay: { board: { text: "Çay Ocağı", sub: "Tavşan kanı", bg: "#5a1f1a", fg: "#ffd9b0", accent: "#e0634e", icon: "cup" }, led: "#ff7043" },
}

export const NEIGHBOUR_SIGNS = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.board])) as Record<NeighbourShop, SignStyle>

/** The big LED box on the neighbour's roof. */
export function neighbourLed(shop: NeighbourShop): SignStyle {
  const { board, led } = S[shop]
  return { text: board.text, bg: "#000", fg: led, accent: led, icon: board.icon, led: true }
}

const TIER_SIGN: Record<TierId, { text: string; icon: SignStyle["icon"] }> = {
  cart: { text: "Simit", icon: "cart" },
  kiosk: { text: "Büfe", icon: "cup" },
  grocery: { text: "Bakkal", icon: "cart" },
  supermarket: { text: "Süpermarket", icon: "cart" },
  restaurant: { text: "Esnaf Lokantası", icon: "pot" },
  fuel: { text: "Benzin", icon: "pot" },
  tech: { text: "Teknoloji", icon: "phone" },
}

/**
 * The board over a career building's door. Buildings you don't run yet carry the name
 * of the business they're meant for, unlit — never a "to let" plate.
 */
export function tierSign(id: TierId, current: TierId): SignStyle {
  const t = tierById(id)
  const s = TIER_SIGN[id]
  if (id === current) return { text: s.text, sub: "Senin dükkanın", bg: t.color, fg: "#1b1712", accent: "#1b1712", icon: s.icon }
  if (tierIndex(id) < tierIndex(current)) return { text: s.text, sub: "Mahallenin esnafı", bg: "#2b2f36", fg: t.color, accent: t.color, icon: s.icon }
  return { text: s.text, sub: t.ready ? "Açılmayı bekliyor" : "Yakında", bg: "#2b2f36", fg: t.color, accent: t.color, icon: s.icon, unlit: true }
}

/** The roof LED of a career building: lit only once you run (or have run) it. */
export function tierLed(id: TierId, current: TierId): SignStyle | null {
  if (tierIndex(id) > tierIndex(current)) return null
  const t = tierById(id)
  return { text: TIER_SIGN[id].text, bg: "#000", fg: t.color, accent: t.color, icon: TIER_SIGN[id].icon, led: true }
}

/** Plate on a building site's hoarding. */
export function siteSign(name: string, day: number): SignStyle {
  return { text: "İnşaat", sub: `${name} · ${day}. gün açılıyor`, bg: "#ffd166", fg: "#1b1712", accent: "#1b1712", icon: "helmet" }
}
