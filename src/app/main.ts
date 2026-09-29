import { createGame, type HudState } from "./engine"

const $ = (id: string) => document.getElementById(id)!
const status = $("status")
const fadeEl = $("fade")
let timer = 0

const say = (msg: string) => {
  status.textContent = msg
  status.classList.add("show")
  clearTimeout(timer)
  timer = window.setTimeout(() => status.classList.remove("show"), 2800)
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
const fade = (swap: () => void) => {
  if (reduceMotion) { swap(); return }
  fadeEl.classList.add("on")
  window.setTimeout(() => {
    swap()
    requestAnimationFrame(() => fadeEl.classList.remove("on"))
  }, 260)
}

const carryText: Record<string, string> = {
  broken: "Elinde: arızalı cihaz → tamir masası",
  fixed: "Elinde: onarılmış cihaz → resepsiyon",
}

const hud = (s: HudState) => {
  $("location").textContent = s.location
  $("exit").hidden = !s.inside
  $("money").textContent = `₺${s.money}`
  $("rep-fill").style.width = `${(s.reputation / 5) * 100}%`
  $("rep-value").textContent = s.reputation.toFixed(1)
  $("day").textContent = `${s.day}. gün`
  $("clock").textContent = s.clock
  $("day-fill").style.width = `${s.dayProgress * 100}%`
  $("parts").textContent = String(s.parts)
  $("q-sales").textContent = String(s.salesQueue)
  $("q-repair").textContent = String(s.repairQueue)
  $("today").textContent = `₺${s.revenueToday}`
  const task = $("task")
  if (s.work) {
    task.hidden = false
    task.textContent = `${s.work.text} %${Math.round(s.work.progress * 100)}`
  } else if (s.carry) {
    task.hidden = false
    task.textContent = carryText[s.carry]
  } else task.hidden = true
}

const game = createGame($("view"), { say, hud, overlay: $("overlay"), fade })
$("exit").addEventListener("click", () => game.exit())
;(window as unknown as { __shop: typeof game }).__shop = game
