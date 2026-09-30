import { createGame, type HudState } from "./engine"
import { CATALOGUE, SHOP_TITLES, type UpgradeShop } from "@/game/upgrades"
import { TIERS, tierById, tierIndex, type Tier, type TierId } from "@/game/career"

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

const newsEl = $("news")
let newsTimer = 0
const news = (title: string, body: string) => {
  $("news-title").textContent = title
  $("news-body").textContent = body
  newsEl.classList.add("show")
  clearTimeout(newsTimer)
  newsTimer = window.setTimeout(() => newsEl.classList.remove("show"), 7500)
}
newsEl.addEventListener("click", () => newsEl.classList.remove("show"))

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
const tl = (n: number) => `₺${Math.round(n).toLocaleString("tr-TR")}`
const setText = (el: HTMLElement, v: string) => { if (el.textContent !== v) el.textContent = v }
const setIcon = (use: Element, id: string) => { if (use.getAttribute("href") !== `#${id}`) use.setAttribute("href", `#${id}`) }

const els = {
  money: $("money"), today: $("today"), clock: $("clock"), day: $("day"), dayFill: $("day-fill"),
  rep: $("rep"), repFill: $("rep-fill"),
  biz: $("biz"), bizIco: $("biz-ico"), bizName: $("biz-name"), bizLine: $("biz-line"), bizBadge: $("biz-badge"),
  goal: $("goal"), goalIco: $("goal-ico"), goalName: $("goal-name"), goalAmt: $("goal-amt"), goalFill: $("goal-fill"), goalCta: $("goal-cta"),
  goBiz: $("go-business") as HTMLButtonElement, goBizIco: $("go-business-ico"), goBizName: $("go-business-name"),
  task: $("task"), taskText: $("task-text"), taskTrack: $("task-track"), taskFill: $("task-fill"),
}

let lastMoney = -1
let lastTier: TierId | null = null
let hudState: HudState | null = null

const hud = (s: HudState) => {
  hudState = s
  const b = s.business
  const tier = tierById(b.tier)

  // Places: the street, plus your shop once you have one with an interior.
  els.goBiz.hidden = !b.level
  document.querySelectorAll<HTMLButtonElement>(".places [data-go]").forEach((btn) => {
    const target = btn.dataset.go === "business" ? b.level : btn.dataset.go
    btn.setAttribute("aria-current", String(target === s.levelId))
  })
  if (lastTier !== b.tier) {
    lastTier = b.tier
    setText(els.goBizName, tier.name)
    setIcon(els.goBizIco, tier.icon)
    els.goBiz.style.setProperty("--c", tier.color)
    setIcon(els.bizIco, tier.icon)
    els.biz.style.setProperty("--c", tier.color)
    if (upg.open) { renderedKey = ""; renderUpgrades() }
  }

  if (s.money !== lastMoney) {
    if (lastMoney >= 0 && s.money > lastMoney && !reduceMotion) {
      els.money.classList.remove("bump")
      void els.money.offsetWidth
      els.money.classList.add("bump")
    }
    lastMoney = s.money
    setText(els.money, tl(s.money))
    if (career.open) renderCareer()
  }
  setText(els.today, tl(s.revenueToday))
  setText(els.clock, s.clock)
  setText(els.day, `${s.day}. gün · ${phase(s.dayProgress)}`)
  els.dayFill.style.width = `${s.dayProgress * 100}%`
  els.repFill.style.width = `${(s.reputation / 5) * 100}%`
  els.rep.setAttribute("aria-label", `İtibar ${s.reputation.toFixed(1)} / 5`)

  // Business card.
  setText(els.bizName, b.name)
  setText(els.bizLine, `${b.queue ? `${b.queue} sırada` : "Sıra boş"} · ${b.stock}`)
  setText(els.bizBadge, String(b.queue))
  els.biz.dataset.alert = b.queue >= 3 || (b.stockLow && b.queue > 0) ? "bad" : b.queue > 0 || b.stockLow ? "warn" : ""

  // Goal card: the next rung of the ladder.
  const n = s.next
  if (n) {
    els.goal.hidden = false
    els.goal.style.setProperty("--c", n.color)
    setIcon(els.goalIco, n.icon)
    setText(els.goalName, n.name)
    const ready = n.ready && s.money >= n.cost
    setText(els.goalAmt, n.ready ? `${tl(Math.min(s.money, n.cost))} / ${tl(n.cost)}` : "Yakında")
    els.goalFill.style.width = `${n.ready ? Math.min(1, s.money / n.cost) * 100 : 0}%`
    els.goal.dataset.ready = String(ready)
    setText(els.goalCta, `${n.name} açmaya hazır · taşın`)
  } else els.goal.hidden = true

  if (s.work) {
    els.task.hidden = false
    setText(els.taskText, `${s.work.text} · %${Math.round(s.work.progress * 100)}`)
    els.taskTrack.hidden = false
    els.taskFill.style.width = `${s.work.progress * 100}%`
  } else els.task.hidden = true

  const count = $("upg-count")
  count.hidden = s.affordableUpgrades === 0
  setText(count, String(s.affordableUpgrades))
  $("upg-open").setAttribute("aria-label", s.affordableUpgrades ? `Geliştir · ${s.affordableUpgrades} geliştirme alınabilir` : "Geliştir")
  if (upg.open) renderUpgrades()
}

// ---------------------------------------------------------------- career roadmap
const career = $("career") as HTMLDialogElement
const ladder = $("ladder")
let careerFocus: TierId | null = null

function stepHtml(t: Tier, money: number, current: TierId) {
  const ci = tierIndex(current)
  const i = tierIndex(t.id)
  const state = t.id === current ? "current" : i < ci && !t.branch ? "done" : !t.ready ? "soon" : "open"
  const next = TIERS.filter((x) => !x.branch)[TIERS.filter((x) => !x.branch).findIndex((x) => x.id === current) + 1]
  let act = ""
  if (state === "current") act = `<span class="tag now">Şu an burada</span>`
  else if (state === "done") act = `<span class="tag done">Geçildi</span>`
  else if (state === "soon") act = `<span class="move"><span class="tag">Yakında</span><small>${tl(t.cost)}</small></span>`
  else if (t.id === next?.id) {
    const lack = t.cost - money
    act = lack > 0
      ? `<span class="move"><button type="button" class="buy" disabled>${tl(t.cost)}</button><small>${tl(lack)} eksik</small></span>`
      : `<span class="move"><button type="button" class="buy" data-open="${t.id}">${tl(t.cost)} · Taşın</button><small>kasadan ödenir</small></span>`
  } else act = `<span class="move"><span class="tag"><svg class="i" style="width:12px;height:12px;vertical-align:-2px"><use href="#i-lock"/></svg> Önce önceki basamak</span><small>${tl(t.cost)}</small></span>`
  return `<li class="step" data-state="${state}" data-focus="${careerFocus === t.id}" style="--c:${t.color}">
    <span class="ico"><svg class="i"><use href="#${t.icon}"/></svg></span>
    <h3>${t.name}</h3>
    <div class="act">${act}</div>
    <p>${t.blurb} <span style="color:var(--faint)">· ${t.goods}</span></p>
  </li>`
}

function renderCareer() {
  const money = game.money
  const cur = game.tier
  const main = TIERS.filter((t) => !t.branch)
  const branch = TIERS.filter((t) => t.branch)
  ladder.innerHTML = main.map((t) => stepHtml(t, money, cur)).join("")
    + `<li class="branch-title">Sonra açılacak dallar</li>`
    + branch.map((t) => stepHtml(t, money, cur)).join("")
  setText($("career-money"), tl(money))
}

const openCareer = (focus?: TierId) => {
  careerFocus = focus ?? null
  renderCareer()
  if (!career.open) career.showModal()
  ladder.querySelector<HTMLElement>('[data-focus="true"]')?.scrollIntoView({ block: "nearest" })
}
ladder.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-open]")
  if (!b) return
  const id = b.dataset.open as TierId
  career.close()
  game.advance(id)
})
$("career-open").addEventListener("click", () => openCareer())
$("career-close").addEventListener("click", () => career.close())
career.addEventListener("click", (e) => { if (e.target === career) career.close() })
$("goal").addEventListener("click", () => openCareer(hudState?.next?.id))

// ---------------------------------------------------------------- celebration
const celebrate = $("celebrate") as HTMLDialogElement
const onCelebrate = (t: Tier) => {
  celebrate.style.setProperty("--c", t.color)
  setIcon($("cel-ico"), t.icon)
  setText($("cel-title"), `${t.name} açıldı`)
  setText($("cel-text"), t.blurb)
  celebrate.showModal()
}
$("cel-ok").addEventListener("click", () => celebrate.close())

const game = createGame($("view"), { say, news, hud, overlay: $("overlay"), fade, openCareer, celebrate: onCelebrate })

document.querySelectorAll<HTMLButtonElement>(".places [data-go]").forEach((btn) => btn.addEventListener("click", () => {
  const target = btn.dataset.go === "business" ? game.businessLevel : btn.dataset.go
  if (target) game.go(target as Parameters<typeof game.go>[0])
}))
els.biz.addEventListener("click", () => {
  const lv = game.businessLevel
  if (lv) game.go(lv)
  else { game.go("outdoor"); say("Tezgâh kaldırımda · müşteri gelince tezgâha tıkla") }
})

// ---------------------------------------------------------------- upgrades drawer
const upg = $("upg") as HTMLDialogElement
const list = $("upg-list")
const tabsEl = $("upg-tabs")
let tab: UpgradeShop = "cart"
let renderedKey = ""

function renderTabs() {
  const here = game.tier
  const tabs: { id: UpgradeShop; color: string; icon: string }[] = [
    { id: here, color: tierById(here).color, icon: tierById(here).icon },
    { id: "city", color: "var(--amber)", icon: "i-city" },
  ]
  if (tab !== "city") tab = here
  tabsEl.innerHTML = tabs.map((t) => `<button type="button" role="tab" data-tab="${t.id}" style="--c:${t.color}" aria-selected="${t.id === tab}">
    <svg class="i"><use href="#${t.icon}"/></svg>${SHOP_TITLES[t.id] ?? t.id}</button>`).join("")
}

function renderUpgrades(flashId?: string) {
  const money = game.money
  const key = `${game.tier}|${tab}|${money}|${CATALOGUE.map((d) => game.upgrades.level(d.id)).join(",")}`
  if (key === renderedKey && !flashId) return
  renderedKey = key
  renderTabs()
  setText($("upg-money"), tl(money))
  const color = tab === "city" ? "var(--amber)" : tierById(tab as TierId).color
  list.replaceChildren(...CATALOGUE.filter((d) => d.shop === tab).map((d) => {
    const level = game.upgrades.level(d.id)
    const max = d.costs.length
    const cost = game.upgrades.nextCost(d.id)
    const card = document.createElement("article")
    card.className = "upg" + (flashId === d.id ? " flash" : "")
    card.style.setProperty("--c", color)
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("")
    const delta = cost === null
      ? `<span class="delta">${d.value(level)}</span>`
      : `<span class="delta">${d.value(level)} → <b>${d.value(level + 1)}</b></span>`
    const button = cost === null
      ? `<button type="button" class="buy done" disabled><svg class="i"><use href="#i-check"/></svg>Tamamlandı</button>`
      : `<button type="button" class="buy" data-buy="${d.id}" ${cost > money ? "disabled" : ""} aria-label="${d.name} seviye ${level + 1}: ${tl(cost)}">${tl(cost)}</button>`
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
tabsEl.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-tab]")
  if (!t) return
  tab = t.dataset.tab as UpgradeShop
  renderedKey = ""
  renderUpgrades()
})
const openUpgrades = () => {
  tab = game.tier
  renderedKey = ""
  renderUpgrades()
  upg.showModal()
}
$("upg-open").addEventListener("click", openUpgrades)
$("upg-close").addEventListener("click", () => upg.close())
upg.addEventListener("click", (e) => { if (e.target === upg) upg.close() })
addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return
  const k = e.key.toLowerCase()
  if (k === "u") { e.preventDefault(); openUpgrades() }
  else if (k === "y") { e.preventDefault(); openCareer() }
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
try { seen = localStorage.getItem("dukkan.help.v2") === "1" } catch { /* storage unavailable */ }
if (!seen) {
  help.showModal()
  try { localStorage.setItem("dukkan.help.v2", "1") } catch { /* ignore */ }
}

;(window as unknown as { __shop: typeof game }).__shop = game
