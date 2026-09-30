/**
 * The neighbourhood grows while you work: every few days something new is built. A
 * development is a building site for a day or two before it opens, so there is
 * usually something going up. Each opening brings a little more foot traffic to every business.
 * Stages are derived from the day counter, so they need no save data of their own.
 */

export type DevId = "playground" | "pitch" | "stationery" | "apartment" | "cafe"
export type DevStage = "planned" | "building" | "open"

export interface Development {
  id: DevId
  /** Day it opens. */
  day: number
  /** Days it spends as a building site before opening (default 1). */
  buildDays?: number
  name: string
  news: string
}

export const DEVELOPMENTS: Development[] = [
  { id: "playground", day: 2, name: "Çocuk parkı", news: "Parka kaydıraklı, salıncaklı bir çocuk parkı kuruldu. Aileler meydana daha sık uğruyor." },
  { id: "pitch", day: 3, buildDays: 2, name: "Halı saha", news: "Mahalleye halı saha açıldı! Maç çıkışı simit ve su iyi gider." },
  { id: "stationery", day: 4, name: "Kırtasiye", news: "Köşedeki kiralık dükkana kırtasiye açıldı. Okul yolu artık buradan geçiyor." },
  { id: "apartment", day: 5, buildDays: 2, name: "Yeni apartman", news: "Karşı sıradaki apartman bitti, altına çiçekçi açıldı. Mahalleye yeni aileler taşındı." },
  { id: "cafe", day: 7, buildDays: 2, name: "Köşe kafe", news: "Köşe başına kafe açıldı. Akşamları sokak daha kalabalık." },
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
