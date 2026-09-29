import { createGame, type HudState } from "./engine"
import { CATALOGUE, type UpgradeShop } from "@/game/upgrades"

const $ = (id: string) => document.getElementById(id)!
const status = $("status")
const fadeEl = $("fade")
let toastTimer = 0

const say = (msg: string) => {
  status.textContent = msg
  status.classList.add("show")
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => status.classList.remove("show"), 2800)
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

const phase = (t: number) => (t < 0.33 ? "Sabah" : t < 0.6 ? "Öğle" : t < 0.85 ? "Akşamüstü" : "Akşam")
const tl = (n: number) => `₺${n.toLocaleString("tr-TR")}`

// Only touch the DOM when a value actually changes.
const setText = (el: HTMLElement, v: string) => { if (el.textContent !== v) el.textContent = v }

const els = {
  money: $("money"), today: $("today"), clock: $("clock"), day: $("day"), dayFill: $("day-fill"),
  rep: $("rep"), repFill: $("rep-fill"),
  lSales: $("l-sales"), bSales: $("b-sales"), lRepair: $("l-repair"), bRepair: $("b-repair"), lScrap: $("l-scrap"), bScrap: $("b-scrap"),
  task: $("task"), taskText: $("task-text"), taskTrack: $("task-track"), taskFill: $("task-fill"),
}
const goButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-go]")]
const shopCard = (id: string) => document.querySelector<HTMLElement>(`.shop[data-go="${id}"]`)!

let lastMoney = -1
const hud = (s: HudState) => {
  for (const b of goButtons) b.setAttribute("aria-current", String(b.dataset.go === s.levelId))

  if (s.money !== lastMoney) {
    if (lastMoney >= 0 && !reduceMotion) {
      els.money.classList.remove("bump")
      void els.money.offsetWidth
      els.money.classList.add("bump")
    }
    lastMoney = s.money
    setText(els.money, tl(s.money))
  }
  setText(els.today, tl(s.revenueToday))
  setText(els.clock, s.clock)
  setText(els.day, `${s.day}. gün · ${phase(s.dayProgress)}`)
  els.dayFill.style.width = `${s.dayProgress * 100}%`
  els.repFill.style.width = `${(s.reputation / 5) * 100}%`
  els.rep.setAttribute("aria-label", `İtibar ${s.reputation.toFixed(1)} / 5`)

  // Shop cards: one plain-language line each, badge = the number that needs you.
  const salesLine = [s.salesQueue ? `${s.salesQueue} müşteri kasada` : "Kasa boş", s.salesLow ? `${s.salesLow} raf azaldı` : ""].filter(Boolean).join(" · ")
  setText(els.lSales, salesLine)
  setText(els.bSales, String(s.salesQueue))
  shopCard("sales").dataset.alert = s.salesQueue >= 3 || s.salesLow >= 3 ? "bad" : s.salesQueue > 0 || s.salesLow > 0 ? "warn" : ""

  const repairLine = [s.repairQueue ? `${s.repairQueue} cihaz sırada` : "Sıra boş", s.repairWaiting ? `${s.repairWaiting} kişi bekliyor` : ""].filter(Boolean).join(" · ")
  setText(els.lRepair, repairLine)
  setText(els.bRepair, String(s.repairQueue))
  shopCard("repair").dataset.alert = s.repairQueue >= 3 ? "bad" : s.repairQueue > 0 || s.repairWaiting > 0 ? "warn" : ""

  setText(els.lScrap, `Elinde ${s.parts} · yığında ${s.salvageLeft}`)
  setText(els.bScrap, String(s.parts))
  shopCard("scrap").dataset.alert = s.parts === 0 && s.repairQueue > 0 ? "bad" : s.parts === 0 ? "warn" : ""

  // Task bar: work in progress beats "what you're carrying".
  if (s.work) {
    els.task.hidden = false
    els.task.dataset.kind = "work"
    setText(els.taskText, `${s.work.text} · %${Math.round(s.work.progress * 100)}`)
    els.taskTrack.hidden = false
    els.taskFill.style.width = `${s.work.progress * 100}%`
  } else if (s.carry) {
    els.task.hidden = false
    els.task.dataset.kind = `carry-${s.carry}`
    setText(els.taskText, s.carry === "broken" ? "Arızalı cihaz elinde · tamir masasına götür" : "Cihaz onarıldı · resepsiyonda teslim et")
    els.taskTrack.hidden = true
  } else els.task.hidden = true

  const n = s.affordableUpgrades
  const count = $("upg-count")
  count.hidden = n === 0
  setText(count, String(n))
  $("upg-open").setAttribute("aria-label", n ? `Geliştir · ${n} geliştirme alınabilir` : "Geliştir")
  if (upg.open) renderUpgrades()
}

const game = createGame($("view"), { say, hud, overlay: $("overlay"), fade })
for (const b of goButtons) b.addEventListener("click", () => game.go(b.dataset.go as Parameters<typeof game.go>[0]))

// ---------------------------------------------------------------- upgrades drawer
const upg = $("upg") as HTMLDialogElement
const list = $("upg-list")
const tabs = [...document.querySelectorAll<HTMLButtonElement>(".tabs button")]
let tab: UpgradeShop = "sales"
let renderedKey = ""
const tabColor: Record<UpgradeShop, string> = { sales: "var(--c-sales)", repair: "var(--c-repair)", scrap: "var(--c-scrap)", city: "var(--amber)" }

function renderUpgrades(flashId?: string) {
  const money = game.money
  const key = `${tab}|${money}|${CATALOGUE.map((d) => game.upgrades.level(d.id)).join(",")}`
  if (key === renderedKey && !flashId) return
  renderedKey = key
  setText($("upg-money"), tl(money))
  for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.tab === tab))
  list.replaceChildren(...CATALOGUE.filter((d) => d.shop === tab).map((d) => {
    const level = game.upgrades.level(d.id)
    const max = d.costs.length
    const cost = game.upgrades.nextCost(d.id)
    const card = document.createElement("article")
    card.className = "upg" + (flashId === d.id ? " flash" : "")
    card.style.setProperty("--c", tabColor[d.shop])
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("")
    const delta = cost === null
      ? `<span class="delta">${d.value(level)}</span>`
      : `<span class="delta">${d.value(level)} → <b>${d.value(level + 1)}</b></span>`
    const button = cost === null
      ? `<button type="button" class="buy done" disabled><svg class="i"><use href="#i-check"/></svg>Tamamlandı</button>`
      : `<button type="button" class="buy" data-buy="${d.id}" ${cost > money ? "disabled" : ""} aria-label="${d.name} seviye ${level + 1}: ₺${cost}">${tl(cost)}</button>`
    card.innerHTML = `
      <span class="ico"><svg class="i"><use href="#${d.icon}"/></svg></span>
      <h3>${d.name}<span class="pips" aria-label="Seviye ${level} / ${max}">${pips}</span></h3>
      <p>${d.desc}</p>
      <div class="foot">${delta}${button}</div>`
    return card
  }))
}

list.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-buy]")
  if (!b || b.disabled) return
  const id = b.dataset.buy!
  if (game.buy(id) !== null) renderUpgrades(id)
})
for (const t of tabs) t.addEventListener("click", () => { tab = t.dataset.tab as UpgradeShop; renderUpgrades() })
const openUpgrades = () => {
  const here = document.querySelector<HTMLElement>('.places [aria-current="true"]')?.dataset.go
  if (here && here !== "outdoor") tab = here as UpgradeShop
  renderedKey = ""
  renderUpgrades()
  upg.showModal()
}
$("upg-open").addEventListener("click", openUpgrades)
$("upg-close").addEventListener("click", () => upg.close())
upg.addEventListener("click", (e) => { if (e.target === upg) upg.close() })
addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "u" && !document.querySelector("dialog[open]")) { e.preventDefault(); openUpgrades() }
})

// Reset with an in-page confirmation step (no browser dialogs).
const resetAsk = $("reset-ask")
const resetConfirm = $("reset-confirm")
resetAsk.addEventListener("click", () => { resetAsk.hidden = true; resetConfirm.hidden = false; $("reset-no").focus() })
$("reset-no").addEventListener("click", () => { resetConfirm.hidden = true; resetAsk.hidden = false })
$("reset-yes").addEventListener("click", () => game.reset())

// Help dialog: opens once on the first visit, then from the "?" button.
const help = $("help") as HTMLDialogElement
$("help-open").addEventListener("click", () => help.showModal())
$("help-close").addEventListener("click", () => help.close())
help.addEventListener("click", (e) => { if (e.target === help) help.close() })
let seen = false
try { seen = localStorage.getItem("dukkan.help") === "1" } catch { /* storage unavailable */ }
if (!seen) {
  help.showModal()
  try { localStorage.setItem("dukkan.help", "1") } catch { /* ignore */ }
}

;(window as unknown as { __shop: typeof game }).__shop = game
