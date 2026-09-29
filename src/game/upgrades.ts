/**
 * Upgrades: a data-driven catalogue. Each upgrade belongs to one business (or the city),
 * has priced levels and an `apply` that modifies derived game stats. Only the upgrades of
 * the business you run now (plus city-wide ones) count; game systems only read `Stats`.
 */
import type { TierId } from "./career"

export type UpgradeShop = TierId | "city"

/** Every tunable number the game systems read. Defaults are the un-upgraded business. */
export interface Stats {
  /** Items the cart holds when full. */
  cartCapacity: number
  /** Cart display tiers (visual). */
  cartTray: 1 | 2 | 3
  cartUmbrella: boolean
  /** Extra display units unlocked (kiosk fridges / grocery shelves). */
  extraUnits: number
  /** Multiplier on the time between customers (lower = busier). */
  spawnMult: number
  priceMult: number
  restockCostMult: number
  patienceMult: number
  /** Seconds between automatic sales by a helper; 0 = no helper. */
  autoServeEvery: number
  repGainMult: number
}

export const BASE_STATS: Readonly<Stats> = {
  cartCapacity: 16,
  cartTray: 1,
  cartUmbrella: false,
  extraUnits: 0,
  spawnMult: 1,
  priceMult: 1,
  restockCostMult: 1,
  patienceMult: 1,
  autoServeEvery: 0,
  repGainMult: 1,
}

export interface UpgradeDef {
  id: string
  shop: UpgradeShop
  name: string
  /** One sentence: what it is and why you'd want it. */
  desc: string
  /** Icon id from the page's SVG sprite. */
  icon: string
  /** Price of each level; length = max level. */
  costs: number[]
  /** Human-readable value at a level (0 = not bought). */
  value(level: number): string
  apply(stats: Stats, level: number): void
}

const pct = (x: number) => `%${Math.round(x * 100)}`
const pick = <T>(arr: T[], level: number) => arr[Math.min(level, arr.length - 1)]
const helper = (secs: number[]) => (l: number) => (l === 0 ? "yok" : `${pick(secs, l)} sn'de bir satış`)

export const CATALOGUE: UpgradeDef[] = [
  // ---------------------------------------------------------------- Seyyar tezgâh
  {
    id: "cart.tray", shop: "cart", icon: "i-layers", name: "Büyük tepsi",
    desc: "Vitrine bir kat daha: tezgâh daha çok simit alır, daha seyrek mal alırsın.",
    costs: [60, 140],
    value: (l) => `${pick([16, 28, 40], l)} ürün`,
    apply: (s, l) => { s.cartCapacity = pick([16, 28, 40], l); s.cartTray = (1 + l) as 1 | 2 | 3 },
  },
  {
    id: "cart.umbrella", shop: "cart", icon: "i-umbrella", name: "Güneş şemsiyesi",
    desc: "Gölgede bekleyen müşteri sırayı kolay kolay bırakmaz.",
    costs: [45],
    value: (l) => `sabır ${pct(pick([1, 1.5], l))}`,
    apply: (s, l) => { s.patienceMult *= pick([1, 1.5], l); s.cartUmbrella = l > 0 },
  },
  {
    id: "cart.call", shop: "cart", icon: "i-megaphone", name: "Taze simit çağrısı",
    desc: "\"Simitçiii!\" diye seslen: yoldan geçenler daha sık uğrar.",
    costs: [40, 110],
    value: (l) => `${pick(["normal", "+%25", "+%50"], l)} müşteri`,
    apply: (s, l) => { s.spawnMult *= pick([1, 0.8, 0.67], l) },
  },
  {
    id: "cart.helper", shop: "cart", icon: "i-user", name: "Çırak",
    desc: "Mahalleden bir çırak: sen olmasan da sıradakine simit verir.",
    costs: [150],
    value: helper([0, 6]),
    apply: (s, l) => { if (l) s.autoServeEvery = 6 },
  },
  // ---------------------------------------------------------------- Küçük büfe
  {
    id: "kiosk.fridge", shop: "kiosk", icon: "i-fridge", name: "İkinci dolap",
    desc: "Büfeye yeni bir içecek dolabı: daha çok çeşit, daha çok satış.",
    costs: [260],
    value: (l) => `${2 + l} dolap/raf`,
    apply: (s, l) => { s.extraUnits = l },
  },
  {
    id: "kiosk.sign", shop: "kiosk", icon: "i-sign", name: "Işıklı tabela",
    desc: "Akşam da uzaktan görünür, müşteri daha sık uğrar.",
    costs: [180, 380],
    value: (l) => `${pick(["normal", "+%20", "+%40"], l)} müşteri`,
    apply: (s, l) => { s.spawnMult *= pick([1, 0.83, 0.71], l) },
  },
  {
    id: "kiosk.cold", shop: "kiosk", icon: "i-snow", name: "Buz gibi içecek",
    desc: "Soğuk içeceğe herkes biraz fazla öder.",
    costs: [220],
    value: (l) => `fiyat ×${pick(["1,00", "1,20"], l)}`,
    apply: (s, l) => { s.priceMult *= pick([1, 1.2], l) },
  },
  {
    id: "kiosk.helper", shop: "kiosk", icon: "i-user", name: "Tezgâhtar",
    desc: "Sen raf doldururken kasaya o bakar.",
    costs: [420],
    value: helper([0, 5]),
    apply: (s, l) => { if (l) s.autoServeEvery = 5 },
  },
  // ---------------------------------------------------------------- Mahalle bakkalı
  {
    id: "grocery.shelves", shop: "grocery", icon: "i-shelf", name: "Ek raf ünitesi",
    desc: "Bakkala yeni raf kurulur; daha çok ürün, daha çok müşteri.",
    costs: [600, 1100],
    value: (l) => `${5 + l} raf`,
    apply: (s, l) => { s.extraUnits = l },
  },
  {
    id: "grocery.sign", shop: "grocery", icon: "i-sign", name: "Işıklı vitrin",
    desc: "Vitrin dikkat çeker, müşteriler daha sık uğrar.",
    costs: [450, 900, 1600],
    value: (l) => `${pick(["normal", "+%14", "+%30", "+%50"], l)} müşteri`,
    apply: (s, l) => { s.spawnMult *= pick([1, 0.88, 0.77, 0.67], l) },
  },
  {
    id: "grocery.premium", shop: "grocery", icon: "i-gem", name: "Seçkin ürünler",
    desc: "Raflara daha kaliteli mal girer, her satış daha çok kazandırır.",
    costs: [700, 1500],
    value: (l) => `fiyat ×${pick(["1,00", "1,15", "1,32"], l)}`,
    apply: (s, l) => { s.priceMult *= pick([1, 1.15, 1.32], l) },
  },
  {
    id: "grocery.supplier", shop: "grocery", icon: "i-truck", name: "Tedarikçi anlaşması",
    desc: "Toptancıyla anlaşma: raf doldurmak daha ucuza gelir.",
    costs: [500, 1000],
    value: (l) => `dolum ${pct(pick([1, 0.8, 0.62], l))}`,
    apply: (s, l) => { s.restockCostMult *= pick([1, 0.8, 0.62], l) },
  },
  {
    id: "grocery.music", shop: "grocery", icon: "i-music", name: "Fon müziği",
    desc: "Kasada bekleyenler daha sabırlı olur.",
    costs: [350],
    value: (l) => `sabır ${pct(pick([1, 1.4], l))}`,
    apply: (s, l) => { s.patienceMult *= pick([1, 1.4], l) },
  },
  {
    id: "grocery.cashier", shop: "grocery", icon: "i-user", name: "Kasiyer",
    desc: "Kasaya bakan biri olursa sen raflarla ilgilenirsin.",
    costs: [900, 1800],
    value: helper([0, 5, 3]),
    apply: (s, l) => { if (l) s.autoServeEvery = pick([0, 5, 3], l) },
  },
  // ---------------------------------------------------------------- Şehir (her işletmede geçerli)
  {
    id: "city.ads", shop: "city", icon: "i-megaphone", name: "Mahalle dedikodusu",
    desc: "Adın ağızdan ağıza yayılır: memnun müşteri itibarını daha hızlı artırır.",
    costs: [120, 600, 2000],
    value: (l) => `itibar ${pct(pick([1, 1.2, 1.4, 1.6], l))}`,
    apply: (s, l) => { s.repGainMult *= pick([1, 1.2, 1.4, 1.6], l) },
  },
]

export const SHOP_TITLES: Record<string, string> = {
  cart: "Seyyar Tezgâh", kiosk: "Küçük Büfe", grocery: "Mahalle Bakkalı", city: "Şehir",
}

export class Upgrades {
  private levels: Record<string, number> = {}
  private listeners: (() => void)[] = []
  private tier: TierId = "cart"
  stats: Stats = { ...BASE_STATS }

  level(id: string) { return this.levels[id] ?? 0 }
  def(id: string) { return CATALOGUE.find((d) => d.id === id) }
  maxed(id: string) { const d = this.def(id); return !!d && this.level(id) >= d.costs.length }
  nextCost(id: string): number | null {
    const d = this.def(id)
    if (!d || this.maxed(id)) return null
    return d.costs[this.level(id)]
  }
  /** Upgrades that apply to the business you run now. */
  current() { return CATALOGUE.filter((d) => d.shop === this.tier || d.shop === "city") }
  affordable(money: number) { return this.current().filter((d) => { const c = this.nextCost(d.id); return c !== null && c <= money }).length }

  onChange(fn: () => void) { this.listeners.push(fn) }

  setTier(t: TierId) { this.tier = t; this.recompute() }

  /** Raise one level. Caller pays; returns the new level. */
  raise(id: string): number {
    this.levels[id] = this.level(id) + 1
    this.recompute()
    return this.levels[id]
  }

  snapshot(): Record<string, number> { return { ...this.levels } }

  restore(levels: Record<string, number>) {
    this.levels = {}
    for (const d of CATALOGUE) {
      const l = Math.floor(Number(levels[d.id] ?? 0))
      if (l > 0) this.levels[d.id] = Math.min(l, d.costs.length)
    }
    this.recompute()
  }

  private recompute() {
    const s: Stats = { ...BASE_STATS }
    for (const d of this.current()) d.apply(s, this.level(d.id))
    this.stats = s
    this.listeners.forEach((fn) => fn())
  }
}
