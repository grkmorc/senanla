/**
 * Career ladder: the businesses you grow through. Each tier has an opening price; the
 * later ones are on the roadmap but not playable yet (`ready: false`).
 */

export type TierId = "cart" | "kiosk" | "grocery" | "supermarket" | "restaurant" | "fuel" | "tech"

export interface Tier {
  id: TierId
  name: string
  /** Short line shown on the roadmap. */
  blurb: string
  /** What you sell there, for the roadmap card. */
  goods: string
  /** Money needed to open it (you pay this when you move). */
  cost: number
  /** Playable in this build. */
  ready: boolean
  /** Icon id from the page's SVG sprite. */
  icon: string
  color: string
  /** Branch businesses sit beside the main ladder on the roadmap. */
  branch?: boolean
}

export const TIERS: Tier[] = [
  { id: "cart", name: "Seyyar Tezgâh", blurb: "Kaldırımda başlıyorsun. Gelen geçene simit ve su sat.", goods: "Simit, su",
    cost: 0, ready: true, icon: "i-cart", color: "#e0634e" },
  { id: "kiosk", name: "Küçük Büfe", blurb: "İlk dükkanın. Müşteri içeri girer, soğuk içecek ve atıştırmalık alır.", goods: "İçecek, atıştırmalık, gazete",
    cost: 500, ready: true, icon: "i-kiosk", color: "#f0a53a" },
  { id: "grocery", name: "Mahalle Bakkalı", blurb: "Raflar dolusu ürün, sadık mahalle müşterisi.", goods: "Temel gıda, temizlik, içecek",
    cost: 2000, ready: true, icon: "i-bag", color: "#3fb3a3" },
  { id: "supermarket", name: "Süpermarket", blurb: "Birden çok kasa, reyonlar ve çalışanlar.", goods: "Her şey",
    cost: 12000, ready: false, icon: "i-cartbig", color: "#6aa7e8" },
  { id: "restaurant", name: "Esnaf Lokantası", blurb: "Tencere yemekleri, öğle kalabalığı.", goods: "Sulu yemek, çorba",
    cost: 20000, ready: false, icon: "i-pot", color: "#d9825b", branch: true },
  { id: "fuel", name: "Benzin İstasyonu", blurb: "Pompalar, market ve oto yıkama.", goods: "Yakıt, market",
    cost: 35000, ready: false, icon: "i-fuel", color: "#c9c34a", branch: true },
  { id: "tech", name: "Teknoloji Mağazası", blurb: "Telefon, bilgisayar ve aksesuar.", goods: "Elektronik",
    cost: 50000, ready: false, icon: "i-phone", color: "#9b7be0", branch: true },
]

export const tierById = (id: TierId) => TIERS.find((t) => t.id === id)!
export const tierIndex = (id: TierId) => TIERS.findIndex((t) => t.id === id)

/** The next tier on the main ladder (branches come after the supermarket). */
export function nextTier(id: TierId): Tier | null {
  const main = TIERS.filter((t) => !t.branch)
  const i = main.findIndex((t) => t.id === id)
  return i >= 0 && i < main.length - 1 ? main[i + 1] : null
}
