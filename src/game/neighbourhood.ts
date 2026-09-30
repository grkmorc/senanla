/**
 * The neighbourhood grows while you work: every few days something new is built. A
 * development is a building site for a day or two before it opens, so there is
 * usually something going up. Each opening brings a little more foot traffic to every business.
 * Stages are derived from the day counter, so they need no save data of their own.
 */

export type DevId = "playground" | "pitch" | "stationery" | "apartment" | "cafe" | "bakery" | "hotel" | "gym"
export type DevStage = "planned" | "building" | "open"

export interface Development {
  id: DevId
  /** Day it opens. */
  day: number
  /** Days it spends as a building site before opening (default 1). */
  buildDays?: number
  name: string
  /** One line for the neighbourhood panel. */
  blurb: string
  /** Icon id from the page's SVG sprite. */
  icon: string
  news: string
}

export const DEVELOPMENTS: Development[] = [
  { id: "playground", day: 2, name: "Çocuk parkı", icon: "i-tree", blurb: "Parkın köşesine kaydırak ve salıncak.",
    news: "Parka kaydıraklı, salıncaklı bir çocuk parkı kuruldu. Aileler meydana daha sık uğruyor." },
  { id: "pitch", day: 3, buildDays: 2, name: "Halı saha", icon: "i-ball", blurb: "Işıklı, fileli kaleli mahalle sahası.",
    news: "Mahalleye halı saha açıldı! Maç çıkışı simit ve su iyi gider." },
  { id: "stationery", day: 4, name: "Kırtasiye", icon: "i-sign", blurb: "Köşedeki boş dükkana kırtasiye geliyor.",
    news: "Köşedeki boş dükkana kırtasiye açıldı. Okul yolu artık buradan geçiyor." },
  { id: "apartment", day: 5, buildDays: 2, name: "Yeni apartman", icon: "i-city", blurb: "Karşı sırada dört katlı apartman, altında çiçekçi.",
    news: "Karşı sıradaki apartman bitti, altına çiçekçi açıldı. Mahalleye yeni aileler taşındı." },
  { id: "cafe", day: 7, buildDays: 2, name: "Köşe kafe", icon: "i-cup", blurb: "Büyük caddenin köşesinde kafe.",
    news: "Köşe başına kafe açıldı. Akşamları sokak daha kalabalık." },
  { id: "bakery", day: 9, buildDays: 2, name: "Pastane", icon: "i-cake", blurb: "Batı ucunda pastaneli yeni bina.",
    news: "Mahalleye pastane açıldı. Sabahları kuyruk kapıya taşıyor." },
  { id: "hotel", day: 11, buildDays: 2, name: "Otel", icon: "i-bed", blurb: "Doğu ucunda beş katlı otel.",
    news: "Otel açıldı! Şehir dışından gelenler sokağa uğramaya başladı." },
  { id: "gym", day: 13, buildDays: 2, name: "Spor salonu", icon: "i-dumbbell", blurb: "Doğu ucunda spor salonu.",
    news: "Spor salonu açıldı. Antrenman çıkışı su ve simit satışları artacak." },
]

/** Extra customers per opened development (spawn interval is divided by 1 + this × n). */
export const FOOTFALL_PER_DEV = 0.06

export function stageOf(d: Development, day: number): DevStage {
  if (day >= d.day) return "open"
  return day >= d.day - (d.buildDays ?? 1) ? "building" : "planned"
}

/** 0..1 through the building phase (`dayProgress` is the fraction of today gone). */
export function buildProgress(d: Development, day: number, dayProgress: number) {
  const days = d.buildDays ?? 1
  return Math.min(1, Math.max(0, (day - (d.day - days) + dayProgress) / days))
}

export function openedCount(day: number) {
  return DEVELOPMENTS.filter((d) => stageOf(d, day) === "open").length
}

/** The next development still to come, for the HUD. */
export function nextDevelopment(day: number): Development | null {
  return DEVELOPMENTS.find((d) => stageOf(d, day) !== "open") ?? null
}
