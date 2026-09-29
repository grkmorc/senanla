/**
 * Upgrades: a data-driven catalogue. Each upgrade has priced levels and an `apply`
 * that modifies derived game stats; game systems only ever read `Stats`, so adding an
 * upgrade is one catalogue entry (plus, optionally, a visual hook in its level).
 */

export type UpgradeShop = "sales" | "repair" | "scrap" | "city"

/** Every tunable number the game systems read. Defaults are the un-upgraded game. */
export interface Stats {
  /** Extra shelves unlocked in the shop (visual + stock). */
  salesExtraShelves: number
  /** Multiplier on the time between shop customers (lower = busier). */
  salesSpawnMult: number
  salesPriceMult: number
  restockCostMult: number
  salesPatienceMult: number
  repairTime: number
  repairFee: number
  repairPatienceMult: number
  stripTime: number
  bonusPartChance: number
  partPrice: number
  repGainMult: number
}

export const BASE_STATS: Readonly<Stats> = {
  salesExtraShelves: 0,
  salesSpawnMult: 1,
  salesPriceMult: 1,
  restockCostMult: 1,
  salesPatienceMult: 1,
  repairTime: 4,
  repairFee: 55,
  repairPatienceMult: 1,
  stripTime: 2.5,
  bonusPartChance: 0,
  partPrice: 14,
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
  /** Human-readable value at a level (0 = not bought), e.g. "4,0 sn". */
  value(level: number): string
  apply(stats: Stats, level: number): void
}

const pct = (x: number) => `%${Math.round(x * 100)}`
const sec = (x: number) => `${x.toFixed(1).replace(".", ",")} sn`
const tl = (x: number) => `₺${Math.round(x)}`
const pick = <T>(arr: T[], level: number) => arr[Math.min(level, arr.length - 1)]

export const CATALOGUE: UpgradeDef[] = [
  // ---------------------------------------------------------------- Mağaza
  {
    id: "sales.shelves", shop: "sales", icon: "i-shelf", name: "Ek raf ünitesi",
    desc: "Mağazaya yeni raf kurulur; daha çok ürün, daha çok müşteri.",
    costs: [120, 240],
    value: (l) => `${5 + l} raf`,
    apply: (s, l) => { s.salesExtraShelves = l },
  },
  {
    id: "sales.sign", shop: "sales", icon: "i-sign", name: "Işıklı vitrin",
    desc: "Vitrin dikkat çeker, müşteriler daha sık uğrar.",
    costs: [90, 180, 320],
    value: (l) => `${pick(["normal", "+%14", "+%30", "+%50"], l)} müşteri`,
    apply: (s, l) => { s.salesSpawnMult *= pick([1, 0.88, 0.77, 0.67], l) },
  },
  {
    id: "sales.premium", shop: "sales", icon: "i-gem", name: "Seçkin ürünler",
    desc: "Raflara daha kaliteli mal girer, her satış daha çok kazandırır.",
    costs: [150, 320],
    value: (l) => `fiyat ×${pick(["1,00", "1,15", "1,32"], l)}`,
    apply: (s, l) => { s.salesPriceMult *= pick([1, 1.15, 1.32], l) },
  },
  {
    id: "sales.supplier", shop: "sales", icon: "i-truck", name: "Tedarikçi anlaşması",
    desc: "Toptancıyla anlaşma: raf doldurmak daha ucuza gelir.",
    costs: [100, 210],
    value: (l) => `dolum ${pct(pick([1, 0.8, 0.62], l))}`,
    apply: (s, l) => { s.restockCostMult *= pick([1, 0.8, 0.62], l) },
  },
  {
    id: "sales.music", shop: "sales", icon: "i-music", name: "Fon müziği",
    desc: "Kasada bekleyenler daha sabırlı olur.",
    costs: [70, 150],
    value: (l) => `sabır ${pct(pick([1, 1.3, 1.6], l))}`,
    apply: (s, l) => { s.salesPatienceMult *= pick([1, 1.3, 1.6], l) },
  },
  // ---------------------------------------------------------------- Tamirhane
  {
    id: "repair.tools", shop: "repair", icon: "i-wrench", name: "Profesyonel alet seti",
    desc: "Daha iyi aletlerle her tamir daha kısa sürer.",
    costs: [110, 240, 420],
    value: (l) => sec(pick([4, 3.2, 2.5, 1.8], l)),
    apply: (s, l) => { s.repairTime = pick([4, 3.2, 2.5, 1.8], l) },
  },
  {
    id: "repair.warranty", shop: "repair", icon: "i-shield", name: "Garanti belgesi",
    desc: "Onarıma garanti verirsin, müşteri daha fazla öder.",
    costs: [140, 290],
    value: (l) => `${tl(55 + l * 15)} / tamir`,
    apply: (s, l) => { s.repairFee += l * 15 },
  },
  {
    id: "repair.lounge", shop: "repair", icon: "i-sofa", name: "Bekleme salonu",
    desc: "Rahat koltuklar ve çay: tamir bekleyenler sabırlanır.",
    costs: [90, 190],
    value: (l) => `sabır ${pct(pick([1, 1.35, 1.75], l))}`,
    apply: (s, l) => { s.repairPatienceMult *= pick([1, 1.35, 1.75], l) },
  },
  // ---------------------------------------------------------------- Hurdalık
  {
    id: "scrap.shears", shop: "scrap", icon: "i-scissors", name: "Hidrolik makas",
    desc: "Hurdayı çok daha hızlı sökersin.",
    costs: [100, 220, 380],
    value: (l) => sec(pick([2.5, 1.9, 1.4, 1.0], l)),
    apply: (s, l) => { s.stripTime = pick([2.5, 1.9, 1.4, 1.0], l) },
  },
  {
    id: "scrap.sorting", shop: "scrap", icon: "i-filter", name: "Ayıklama bandı",
    desc: "Her sökümde ikinci bir parça çıkma şansı.",
    costs: [130, 270],
    value: (l) => `${pct(pick([0, 0.25, 0.5], l))} ek parça`,
    apply: (s, l) => { s.bonusPartChance = pick([0, 0.25, 0.5], l) },
  },
  {
    id: "scrap.deal", shop: "scrap", icon: "i-handshake", name: "Toptancı anlaşması",
    desc: "Hurdalık tezgâhından parça almak ucuzlar.",
    costs: [80, 180],
    value: (l) => `${tl(pick([14, 11, 8], l))} / parça`,
    apply: (s, l) => { s.partPrice = pick([14, 11, 8], l) },
  },
  // ---------------------------------------------------------------- Şehir
  {
    id: "city.ads", shop: "city", icon: "i-megaphone", name: "Gazete ilanı",
    desc: "Adın duyulur: memnun müşteriler itibarını daha hızlı artırır.",
    costs: [200, 420],
    value: (l) => `itibar ${pct(pick([1, 1.25, 1.5], l))}`,
    apply: (s, l) => { s.repGainMult *= pick([1, 1.25, 1.5], l) },
  },
]

export const SHOP_TITLES: Record<UpgradeShop, string> = {
  sales: "Mağaza", repair: "Tamirhane", scrap: "Hurdalık", city: "Şehir",
}

export class Upgrades {
  private levels: Record<string, number> = {}
  private listeners: (() => void)[] = []
  stats: Stats = { ...BASE_STATS }

  level(id: string) { return this.levels[id] ?? 0 }
  def(id: string) { return CATALOGUE.find((d) => d.id === id) }
  maxed(id: string) { const d = this.def(id); return !!d && this.level(id) >= d.costs.length }
  nextCost(id: string): number | null {
    const d = this.def(id)
    if (!d || this.maxed(id)) return null
    return d.costs[this.level(id)]
  }
  affordable(money: number) { return CATALOGUE.filter((d) => { const c = this.nextCost(d.id); return c !== null && c <= money }).length }

  onChange(fn: () => void) { this.listeners.push(fn) }

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
    for (const d of CATALOGUE) d.apply(s, this.level(d.id))
    this.stats = s
    this.listeners.forEach((fn) => fn())
  }
}
