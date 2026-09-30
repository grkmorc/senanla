/**
 * Who lives on the street: sign styles for the neighbours' shops and for the buildings of
 * your career ladder (yours, to let, or coming soon).
 */
import type { SignStyle } from "@/app/signage"
import { tierById, tierIndex, type TierId } from "@/game/career"

export type NeighbourShop = "berber" | "firin" | "eczane" | "kasap" | "kirtasiye" | "kahvehane" | "terzi" | "cicekci" | "kafe"

export const NEIGHBOUR_SIGNS: Record<NeighbourShop, SignStyle> = {
  berber: { text: "Berber", sub: "Saç · Sakal · Tıraş", bg: "#1d3557", fg: "#f1faee", accent: "#e63946", icon: "pole" },
  firin: { text: "Fırın", sub: "Ekmek · Pide · Poğaça", bg: "#7a4a22", fg: "#ffe3b3", accent: "#f2a541", icon: "bread" },
  eczane: { text: "Eczane", sub: "Sağlıklı günler", bg: "#f7f4ef", fg: "#c62828", accent: "#c62828", icon: "cross" },
  kasap: { text: "Kasap", sub: "Et · Tavuk · Sucuk", bg: "#8e1f1f", fg: "#fff4ec", accent: "#f0c9a0", icon: "knife" },
  kirtasiye: { text: "Kırtasiye", sub: "Defter · Kalem · Fotokopi", bg: "#2a6fb0", fg: "#ffffff", accent: "#ffd166", icon: "pencil" },
  kahvehane: { text: "Kahvehane", sub: "Çay · Kahve · Okey", bg: "#3b2a20", fg: "#f3c77a", accent: "#c0392b", icon: "cup" },
  terzi: { text: "Terzi", sub: "Tadilat · Paça · Fermuar", bg: "#4b3563", fg: "#f4ecff", accent: "#d4a5ff", icon: "needle" },
  cicekci: { text: "Çiçekçi", sub: "Buket · Saksı · Çelenk", bg: "#f5d6e0", fg: "#7a1f45", accent: "#3f8f4f", icon: "flower" },
  kafe: { text: "Köşe Kafe", sub: "Kahve · Tost · Tatlı", bg: "#244d43", fg: "#f6efe2", accent: "#e9b872", icon: "cup" },
}

/** "For let" plate hung on an empty shop. */
export const TO_LET: SignStyle = { text: "Kiralık", sub: "Emlak · 0 555 010 20 30", bg: "#f2eee6", fg: "#c0392b", accent: "#c0392b", unlit: true }

const TIER_SIGN: Record<TierId, { text: string; icon: SignStyle["icon"] }> = {
  cart: { text: "Simit", icon: "cart" },
  kiosk: { text: "Büfe", icon: "cup" },
  grocery: { text: "Bakkal", icon: "cart" },
  supermarket: { text: "Süpermarket", icon: "cart" },
  restaurant: { text: "Esnaf Lokantası", icon: "pot" },
  fuel: { text: "Benzin", icon: "pot" },
  tech: { text: "Teknoloji", icon: "phone" },
}

/** The sign over a career building, given the business you run now. */
export function tierSign(id: TierId, current: TierId): SignStyle {
  const t = tierById(id)
  const s = TIER_SIGN[id]
  if (id === current) return { text: s.text, sub: "Senin dükkanın", bg: t.color, fg: "#1b1712", accent: "#1b1712", icon: s.icon }
  if (tierIndex(id) > tierIndex(current) && !t.ready) {
    return { text: s.text, sub: "Yakında açılıyor", bg: "#2b2f36", fg: t.color, accent: t.color, icon: s.icon }
  }
  return TO_LET
}

/** Plate on a building site's hoarding. */
export function siteSign(name: string, day: number): SignStyle {
  return { text: "İnşaat", sub: `${name} · ${day}. gün açılıyor`, bg: "#ffd166", fg: "#1b1712", accent: "#1b1712", icon: "helmet" }
}
