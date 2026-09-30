/**
 * Game engine: renderer, post-processing, camera, input, the player and level switching.
 * Every level keeps simulating; only the active one is rendered. The app owns this whole
 * layer (Vibe3D consumer role) — models come from @shop-kit.
 */
import {
  WebGLRenderer, Vector2, Vector3, Raycaster, Plane, Mesh, RingGeometry, MeshBasicMaterial,
  MeshStandardMaterial, ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, MathUtils, type Object3D,
} from "three"
import { createShopKit } from "@/kits/shop-kit/context"
import { IsoCameraRig } from "./iso-camera"
import { Pawn, disposePawnAssets } from "./pawn"
import { RenderPipeline, defaultQuality } from "./render-pipeline"
import { Economy, type Tone } from "@/game/economy"
import { loadGame, saveGame, clearSave } from "@/game/save"
import type { Upgrades } from "@/game/upgrades"
import type { Mood } from "@/game/crowd"
import { nextTier, tierById, type Tier, type TierId } from "@/game/career"
import type { Interactable, Level, LevelId } from "@/levels/level"
import { createOutdoorLevel } from "@/levels/outdoor"
import type { DevId } from "@/game/neighbourhood"
import { createKioskLevel } from "@/levels/kiosk"
import { createGroceryLevel } from "@/levels/grocery"

export interface HudState {
  location: string
  levelId: LevelId
  inside: boolean
  money: number
  reputation: number
  day: number
  clock: string
  dayProgress: number
  business: {
    tier: TierId
    name: string
    /** Level to open for this business; null when it lives on the street. */
    level: LevelId | null
    queue: number
    /** One plain line about stock, e.g. "12/16 simit" or "2 raf azaldı". */
    stock: string
    stockLow: boolean
  }
  next: Tier | null
  work: { text: string; progress: number } | null
  revenueToday: number
  /** Upgrades you could buy right now. */
  affordableUpgrades: number
}

export interface GameUi {
  say(msg: string): void
  /** Neighbourhood news: something new opened on the street. */
  news(title: string, body: string): void
  hud(state: HudState): void
  /** Container for floating world-space labels. */
  overlay: HTMLElement
  /** Fade to black, run `swap`, fade back in. */
  fade(swap: () => void): void
  /** Show the career roadmap, optionally highlighting one business. */
  openCareer(focus?: TierId): void
  /** A new business just opened. */
  celebrate(tier: Tier): void
}

export interface GameHandle {
  dispose(): void
  exit(): void
  /** Open a place directly (HUD shortcuts). */
  go(id: LevelId): void
  readonly upgrades: Upgrades
  readonly money: number
  readonly tier: TierId
  /** Move up to a business (pays its price). */
  advance(id: TierId): boolean
  /** Level of the business you run now, or null for the street cart. */
  readonly businessLevel: LevelId | null
  /** Buy the next level; returns the new level or null. */
  buy(id: string): number | null
  /** Wipe the save and start over. */
  reset(): void
  /** Fly the street camera over to a neighbourhood development. */
  showDevelopment(id: DevId): void
  readonly debug: {
    walkTo(x: number, z: number): boolean
    interact(id: string): boolean
    enter(id: LevelId): void
    setView(opts: { yawStep?: number; zoom?: number; focus?: [number, number] }): void
    fastForward(seconds: number, step?: number): void
    readonly level: LevelId
    readonly player: Object3D
    readonly economy: Economy
    readonly levels: Record<LevelId, Level>
  }
}

export function createGame(container: HTMLElement, ui: GameUi): GameHandle {
  // ---------------------------------------------------------------- renderer
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  container.appendChild(renderer.domElement)
  const el = renderer.domElement

  // ---------------------------------------------------------------- world state
  const kit = createShopKit()
  // App-owned window glass so shop windows can glow at night (kit-level override).
  const windowGlass = new MeshStandardMaterial({ color: "#2c3d4a", roughness: 0.12, metalness: 0.5, emissive: "#ffc98a", emissiveIntensity: 0 })
  kit.materials.setKitOverride("surface.glass", windowGlass)

  // Floating +₺ / warning labels.
  const floating: { el: HTMLElement; at: Vector3; t: number; level: Level }[] = []
  const economy = new Economy({
    say: ui.say,
    popup(at: Vector3, text: string, tone: Tone, where: string) {
      const level = levels[where as LevelId] ?? active
      const node = document.createElement("div")
      node.className = `pop pop-${tone}`
      node.textContent = text
      node.hidden = level !== active
      ui.overlay.appendChild(node)
      floating.push({ el: node, at: at.clone().setY(1.8), t: 0, level })
    },
  })

  const resumed = loadGame(economy)
  economy.onNewDay(() => saveGame(economy))
  const go = (to: LevelId) => switchTo(to)
  const outdoor = createOutdoorLevel(kit, economy, go, windowGlass, (focus) => ui.openCareer(focus), ui.news)
  const kiosk = createKioskLevel(kit, economy, go)
  const grocery = createGroceryLevel(kit, economy, go)
  const levels: Record<LevelId, Level> = { outdoor, kiosk, grocery }
  let active: Level = levels.outdoor

  const LEVEL_OF: Partial<Record<TierId, LevelId>> = { kiosk: "kiosk", grocery: "grocery" }
  const floors = { kiosk: kiosk.floor, grocery: grocery.floor }
  const applyTier = (t: TierId) => {
    for (const [id, f] of Object.entries(floors)) {
      const on = id === t
      if (f.active && !on) f.clear()
      f.active = on
    }
  }
  economy.onTierChange(applyTier)
  applyTier(economy.tier)

  // ---------------------------------------------------------------- player
  const player = new Pawn({ skin: "#e8c4a0", shirt: "#ece6da", pants: "#3a3f4a", hair: "#2a1d16", apron: "#2f6f6a" })
  player.root.name = "app/player"

  const marker = new Mesh(new RingGeometry(0.16, 0.22, 32), new MeshBasicMaterial({ color: "#5fe3ff", transparent: true, opacity: 0, depthWrite: false }))
  marker.rotation.x = -Math.PI / 2
  marker.userData.excludeFromExport = true
  let markerT = 0
  const flashMarker = (x: number, z: number, color: string) => {
    marker.position.set(x, groundAt(x, z) + 0.03, z)
    ;(marker.material as MeshBasicMaterial).color.set(color)
    markerT = 1
  }
  const groundAt = (x: number, z: number) => active.groundAt?.(x, z) ?? 0

  // ---------------------------------------------------------------- camera + render
  const rig = new IsoCameraRig(container.clientWidth / container.clientHeight)
  const pipeline = new RenderPipeline(renderer, active.scene, rig.camera, defaultQuality())

  // Building name plates (persistent, per level) and patience bars (pooled).
  const signEls = new Map<Level, HTMLElement[]>()
  for (const lv of Object.values(levels)) {
    signEls.set(lv, lv.labels.map((l) => {
      const n = document.createElement("div")
      n.className = "sign"
      n.textContent = l.text
      if (l.color) n.style.setProperty("--dot", l.color)
      n.hidden = true
      ui.overlay.appendChild(n)
      return n
    }))
  }
  const moodPool: HTMLElement[] = []
  const moodEl = (i: number) => {
    while (moodPool.length <= i) {
      const n = document.createElement("div")
      n.className = "mood"
      n.innerHTML = "<span></span>"
      ui.overlay.appendChild(n)
      moodPool.push(n)
    }
    return moodPool[i]
  }

  const walkable = (lv: Level) => lv.walkable !== false
  const enterLevel = (lv: Level, from: LevelId | null) => {
    active.scene.remove(player.root, marker)
    for (const n of signEls.get(active) ?? []) n.hidden = true
    active = lv
    const a = lv.arrival(from)
    player.stop()
    rig.bounds = lv.bounds
    rig.minZoom = lv.zoom.min
    rig.maxZoom = lv.zoom.max
    rig.zoom = lv.zoom.initial
    if (walkable(lv)) {
      player.root.position.copy(a.pos).setY(groundAt(a.pos.x, a.pos.z))
      player.faceTowards(a.face)
      lv.scene.add(player.root, marker)
      rig.follow = true
      rig.focus.set(a.pos.x, 0, a.pos.z)
    } else {
      // The street is a simulation you watch; there is no player to follow.
      rig.follow = false
      const f = lv.cameraFocus?.(from) ?? a.pos
      rig.focus.set(f.x, 0, f.z)
    }
    rig.clampFocus()
    rig.snap()
    if (lv === levels.outdoor && pendingFly) { flyTo(pendingFly); pendingFly = null }
    pipeline.setScene(lv.scene)
    pipeline.setHover([])
    lv.setDayProgress(economy.dayProgress)
    for (const f of floating) f.el.hidden = f.level !== lv
  }

  let switching = false
  // Smooth camera flight to a spot on the street (neighbourhood panel "Göster").
  let fly: { from: Vector3; to: Vector3; z0: number; z1: number; t: number } | null = null
  let pendingFly: Vector3 | null = null
  const flyTo = (to: Vector3) => {
    rig.follow = false
    fly = { from: rig.focus.clone(), to: to.clone().setY(0), z0: rig.zoom, z1: Math.min(rig.maxZoom, 11), t: 0 }
  }

  const switchTo = (to: LevelId) => {
    if (switching || to === active.id) return
    switching = true
    const from = active.id
    ui.fade(() => {
      enterLevel(levels[to], from)
      switching = false
      ui.say(levels[to].title)
    })
  }

  // ---------------------------------------------------------------- movement
  const walkTo = (x: number, z: number, then: (() => void) | null = null): boolean => {
    const ok = player.goTo(active.nav, x, z, then)
    if (!ok) { ui.say("Oraya yol yok"); flashMarker(x, z, "#ff6b5f"); return false }
    const end = player.destination ?? player.root.position
    flashMarker(end.x, end.z, "#5fe3ff")
    rig.follow = true
    return true
  }
  const useThing = (it: Interactable): boolean => {
    const s = it.spot()
    return walkTo(s.x, s.z, () => {
      player.faceTowards(it.face())
      it.interact()
    })
  }

  // ---------------------------------------------------------------- input
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const ground = new Plane(new Vector3(0, 1, 0), 0)
  const setRay = (x: number, y: number) => {
    const r = el.getBoundingClientRect()
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, rig.camera)
  }
  const pick = (): Interactable | null => {
    let best: { it: Interactable; d: number } | null = null
    for (const it of active.interactables) {
      const hit = raycaster.intersectObject(it.pick, true)[0]
      if (hit && (!best || hit.distance < best.d)) best = { it, d: hit.distance }
    }
    return best?.it ?? null
  }

  const pointers = new Map<number, { x: number; y: number }>()
  let drag: { x: number; y: number; button: number; moved: boolean; multi: boolean } | null = null
  let pinch: { dist: number; mid: { x: number; y: number } } | null = null
  const twoFinger = () => {
    const [a, b] = [...pointers.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }
  const tip = document.createElement("div")
  tip.className = "tip"
  tip.hidden = true
  ui.overlay.appendChild(tip)

  const onDown = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) { pinch = twoFinger(); if (drag) drag.multi = true }
    else drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false, multi: false }
  }
  const onMove = (e: PointerEvent) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch && pointers.size === 2) {
      const now = twoFinger()
      rig.panPixels(now.mid.x - pinch.mid.x, now.mid.y - pinch.mid.y, el.clientHeight)
      if (now.dist > 0 && pinch.dist > 0) rig.zoomBy(pinch.dist / now.dist)
      pinch = now
      return
    }
    if (drag) {
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (Math.hypot(dx, dy) > 6) drag.moved = true
      if (drag.moved && (drag.button === 2 || drag.button === 1 || (drag.button === 0 && e.shiftKey))) {
        rig.panPixels(dx, dy, el.clientHeight)
        drag.x = e.clientX
        drag.y = e.clientY
      }
      return
    }
    if (e.pointerType !== "mouse") return
    setRay(e.clientX, e.clientY)
    const it = pick()
    pipeline.setHover(it ? [it.pick] : [])
    el.style.cursor = it ? "pointer" : "crosshair"
    tip.hidden = !it
    if (it) {
      tip.textContent = it.label
      tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`
    }
  }
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = null
    const d = drag
    if (pointers.size > 0) return
    drag = null
    if (switching || !d || d.moved || d.multi || d.button !== 0 || e.type === "pointercancel") return
    setRay(e.clientX, e.clientY)
    const it = pick()
    if (!walkable(active)) { if (it) it.interact(); return }
    if (it) { useThing(it); return }
    ground.constant = -groundAt(rig.focus.x, rig.focus.z)
    const hit = raycaster.ray.intersectPlane(ground, new Vector3())
    if (hit) walkTo(hit.x, hit.z)
  }
  const onWheel = (e: WheelEvent) => { e.preventDefault(); rig.zoomBy(Math.exp(e.deltaY * 0.0012)) }
  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector("dialog[open]")) return
    const k = e.key.toLowerCase()
    if (k === "q") rig.rotateStep(-1)
    else if (k === "e") rig.rotateStep(1)
    else if (k === "f" || k === " ") {
      if (walkable(active)) rig.follow = true
      else {
        // On the street, jump back to your business.
        const f = active.cameraFocus?.(null)
        if (f) { rig.focus.set(f.x, 0, f.z); rig.zoom = active.zoom.initial; rig.clampFocus() }
      }
    }
    else if (k === "c") { rig.follow = !rig.follow; ui.say(rig.follow ? "Takip açık" : "Serbest kamera") }
    else if (k === "escape" && active.id !== "outdoor") switchTo("outdoor")
    else if (k === "g") {
      pipeline.setQuality(pipeline.quality === "high" ? "low" : "high")
      resize()
      ui.say(pipeline.quality === "high" ? "Grafik: yüksek" : "Grafik: düşük")
    }
  }
  el.addEventListener("contextmenu", (e) => e.preventDefault())
  el.addEventListener("pointerdown", onDown)
  el.addEventListener("pointermove", onMove)
  el.addEventListener("pointerup", onUp)
  el.addEventListener("pointercancel", onUp)
  el.addEventListener("pointerleave", () => { tip.hidden = true })
  el.addEventListener("wheel", onWheel, { passive: false })
  addEventListener("keydown", onKey)

  const resize = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    pipeline.setSize(w, h)
    rig.setAspect(w / h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  // ---------------------------------------------------------------- simulation
  const simulate = (dt: number) => {
    economy.update(dt)
    if (walkable(active)) player.update(dt)
    player.root.position.y = groundAt(player.root.position.x, player.root.position.z)
    const ctx = { playerMoving: player.moving, playerPos: player.root.position }
    const idle = { playerMoving: true, playerPos: new Vector3(1e4, 0, 1e4) }
    for (const lv of Object.values(levels)) lv.update(dt, lv === active ? ctx : idle)
  }

  // ---------------------------------------------------------------- loop
  const proj = new Vector3()
  const toScreen = (p: Vector3) => {
    proj.copy(p).project(rig.camera)
    return [(proj.x * 0.5 + 0.5) * el.clientWidth, (-proj.y * 0.5 + 0.5) * el.clientHeight, proj.z] as const
  }
  let last = performance.now()
  let raf = 0
  let hudT = 0
  let saveT = 5
  let lightT = 0
  const tick = (now: number) => {
    // rAF timestamps can precede the performance.now() taken at start: never step backwards.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = Math.max(last, now)
    if (!switching) simulate(dt)

    if (markerT > 0) {
      markerT = Math.max(0, markerT - dt * 1.2)
      ;(marker.material as MeshBasicMaterial).opacity = markerT
      marker.scale.setScalar(1 + (1 - markerT) * 0.6)
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.1)
      const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - (-2 * fly.t + 2) ** 2 / 2
      rig.focus.lerpVectors(fly.from, fly.to, e)
      // Pull back mid-flight, settle in close.
      rig.zoom = MathUtils.lerp(fly.z0, fly.z1, e) + Math.sin(e * Math.PI) * 5
      if (fly.t >= 1) fly = null
    }
    if (rig.follow && walkable(active)) rig.focus.lerp(new Vector3(player.root.position.x, 0, player.root.position.z), 1 - Math.exp(-dt * 5))
    rig.clampFocus()
    rig.update(dt)
    lightT -= dt
    if (lightT <= 0) { active.setDayProgress(economy.dayProgress); lightT = 0.25 }
    pipeline.render(dt)

    // Sign plates over buildings.
    const signs = signEls.get(active) ?? []
    active.labels.forEach((l, i) => {
      const [x, y, z] = toScreen(l.at)
      const n = signs[i]
      const kind = l.kind ?? "own"
      n.hidden = z > 1 || kind === "hidden"
      if (n.hidden) return
      const text = l.text
      if (n.textContent !== text) n.textContent = text
      if (n.dataset.kind !== kind) n.dataset.kind = kind
      const alert = String(!!l.alert)
      if (n.dataset.alert !== alert) n.dataset.alert = alert
      n.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    })

    // Patience bars.
    const moods: Mood[] = active.moods()
    moods.forEach((m, i) => {
      const n = moodEl(i)
      n.hidden = false
      const [x, y] = toScreen(m.pawn.headTop(proj))
      n.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
      ;(n.firstElementChild as HTMLElement).style.width = `${m.ratio * 100}%`
      n.dataset.level = m.ratio > 0.5 ? "ok" : m.ratio > 0.25 ? "warn" : "bad"
      n.dataset.kind = m.kind
    })
    for (let i = moods.length; i < moodPool.length; i++) moodPool[i].hidden = true

    // Floating labels rise and fade.
    for (let i = floating.length - 1; i >= 0; i--) {
      const f = floating[i]
      f.t += dt / 1.4
      if (f.t >= 1) { f.el.remove(); floating.splice(i, 1); continue }
      f.el.hidden = f.level !== active
      const [x, y] = toScreen(proj.copy(f.at).setY(f.at.y + f.t * 0.8))
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      f.el.style.opacity = String(1 - f.t * f.t)
    }

    saveT -= dt
    if (saveT <= 0) { saveGame(economy); saveT = 5 }
    hudT -= dt
    if (hudT <= 0) {
      hudT = 0.1
      ui.hud({
        location: active.title,
        levelId: active.id,
        inside: active.id !== "outdoor",
        money: economy.money,
        reputation: economy.reputation,
        day: economy.day,
        clock: economy.clock(),
        dayProgress: economy.dayProgress,
        business: businessState(),
        next: nextTier(economy.tier),
        work: active.work(),
        revenueToday: economy.revenueToday,
        affordableUpgrades: economy.upgrades.affordable(economy.money),
      })
    }
    raf = requestAnimationFrame(tick)
  }

  const businessState = (): HudState["business"] => {
    const t = economy.tier
    const name = tierById(t).name
    if (t === "cart") {
      const st = outdoor.stall
      return { tier: t, name, level: null, queue: st.queueLength, stock: `${st.stock}/${st.capacity} simit`, stockLow: st.stock <= st.capacity * 0.25 }
    }
    const f = t === "kiosk" ? kiosk.floor : grocery.floor
    const low = f.lowShelves
    return { tier: t, name, level: LEVEL_OF[t] ?? null, queue: f.queueLength, stock: low ? `${low} raf azaldı` : "Raflar dolu", stockLow: low > 0 }
  }

  const advance = (id: TierId): boolean => {
    if (!economy.openTier(id)) return false
    saveGame(economy)
    const t = tierById(id)
    const lv = LEVEL_OF[id]
    if (lv) {
      switching = true
      ui.fade(() => {
        enterLevel(levels[lv], "outdoor")
        switching = false
        ui.celebrate(t)
      })
    } else ui.celebrate(t)
    return true
  }

  enterLevel(levels.outdoor, null)
  raf = requestAnimationFrame(tick)
  ui.say(resumed ? `Kaldığın yerden devam · ${tierById(economy.tier).name}, ${economy.day}. gün`
    : "Seyyar tezgâhın hazır · müşteri gelince tezgâha tıkla, sat")
  const onHide = () => saveGame(economy)
  addEventListener("pagehide", onHide)

  return {
    exit: () => { if (active.id !== "outdoor") switchTo("outdoor") },
    go: (id) => switchTo(id),
    upgrades: economy.upgrades,
    get money() { return economy.money },
    get tier() { return economy.tier },
    advance,
    get businessLevel() { return LEVEL_OF[economy.tier] ?? null },
    buy: (id) => { const l = economy.buyUpgrade(id); if (l !== null) saveGame(economy); return l },
    showDevelopment: (id) => {
      const at = outdoor.locate(id)
      if (!at) return
      if (active !== levels.outdoor) { pendingFly = at; switchTo("outdoor") } else flyTo(at)
    },
    reset: () => { removeEventListener("pagehide", onHide); clearSave(); location.reload() },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      removeEventListener("keydown", onKey)
      removeEventListener("pagehide", onHide)
      saveGame(economy)
      Object.values(levels).forEach((lv) => lv.dispose())
      player.dispose()
      disposePawnAssets()
      kit.dispose()
      windowGlass.dispose()
      marker.geometry.dispose()
      ;(marker.material as MeshBasicMaterial).dispose()
      pipeline.dispose()
      renderer.dispose()
      ui.overlay.replaceChildren()
      el.remove()
    },
    debug: {
      walkTo: (x, z) => walkTo(x, z),
      interact: (id) => {
        const it = active.interactables.find((i) => i.id === id)
        if (!it) return false
        if (!walkable(active)) { it.interact(); return true }
        return useThing(it)
      },
      enter: (id) => { if (id !== active.id) enterLevel(levels[id], active.id) },
      setView({ yawStep, zoom, focus }) {
        if (yawStep) rig.rotateStep(yawStep)
        if (zoom) rig.zoom = zoom
        if (focus) { rig.follow = false; rig.focus.set(focus[0], 0, focus[1]) }
        rig.snap()
      },
      fastForward(seconds, step = 1 / 30) { for (let t = 0; t < seconds; t += step) simulate(step) },
      get level() { return active.id },
      get player() { return player.root },
      economy,
      levels,
    },
  }
}
