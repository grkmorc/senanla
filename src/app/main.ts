import { createShopScene } from "./shop-scene"
import type { HudState } from "@/game/shop-game"

const $ = (id: string) => document.getElementById(id)!
const status = $("status")
let timer = 0

const say = (msg: string) => {
  status.textContent = msg
  status.classList.add("show")
  clearTimeout(timer)
  timer = window.setTimeout(() => status.classList.remove("show"), 2800)
}

const carryText: Record<string, string> = {
  broken: "Elinde: arızalı cihaz → tamir masası",
  fixed: "Elinde: tamir edilmiş cihaz → kasa",
}

const hud = (s: HudState) => {
  $("money").textContent = `₺${s.money}`
  $("rep-fill").style.width = `${(s.reputation / 5) * 100}%`
  $("rep-value").textContent = s.reputation.toFixed(1)
  $("day").textContent = `${s.day}. gün`
  $("clock").textContent = s.clock
  $("day-fill").style.width = `${s.dayProgress * 100}%`
  $("queue").textContent = String(s.queue)
  $("today").textContent = `₺${s.revenueToday}`
  const task = $("task")
  if (s.repairProgress !== null && s.repairProgress > 0) {
    task.hidden = false
    task.textContent = `Tamir %${Math.round(s.repairProgress * 100)}`
  } else if (s.carry) {
    task.hidden = false
    task.textContent = carryText[s.carry]
  } else task.hidden = true
}

const handle = createShopScene($("view"), { say, hud, overlay: $("overlay") })
;(window as unknown as { __shop: typeof handle }).__shop = handle
