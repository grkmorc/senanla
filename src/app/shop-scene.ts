/**
 * Consumer scene: isometric shop built from @shop-kit models, plus the shop game loop.
 * The app owns renderer, camera, loop, navigation, input and UI (Vibe3D consumer role).
 */
import {
  WebGLRenderer, Scene, Color, HemisphereLight, DirectionalLight, PointLight,
  Vector2, Vector3, Raycaster, Plane, Mesh, RingGeometry, MeshBasicMaterial,
  Box3, Box3Helper, Object3D, ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace,
} from "three"
import { createShopKit } from "@/kits/shop-kit/context"
import { createShopFloor, WALL_T } from "@/models/shop-kit/shop-floor"
import { createModularShelf } from "@/models/shop-kit/modular-shelf"
import { createRepairBench } from "@/models/shop-kit/repair-bench"
import { createCheckoutCounter } from "@/models/shop-kit/checkout-counter"
import type { ModelInstance } from "@/lib/vibe3d/model"
import { NavGrid } from "./nav-grid"
import { IsoCameraRig } from "./iso-camera"
import { Pawn, disposePawnAssets } from "./pawn"
import { ShopGame, type HudState, type ShelfSlot } from "@/game/shop-game"

type AnyModel = ModelInstance<any, any, any>

interface Placed {
  id: string
  label: string
  model: AnyModel
  /** Socket the player walks to before interacting. */
  socket: string
  interact: () => void
}

export interface ShopUi {
  say(msg: string): void
  hud(state: HudState): void
  /** Container for floating world-space labels. */
  overlay: HTMLElement
}

export interface ShopSceneHandle {
  dispose(): void
  readonly debug: {
    walkTo(x: number, z: number): boolean
    interact(id: string): boolean
    setView(opts: { yawStep?: number; zoom?: number; focus?: [number, number] }): void
    readonly pawn: Object3D
    readonly game: ShopGame
    /** Advance the simulation without rendering (tests). */
    fastForward(seconds: number, step?: number): void
  }
}

export function createShopScene(container: HTMLElement, ui: ShopUi): ShopSceneHandle {
  // ---------------------------------------------------------------- renderer
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color("#1a1c21")
  scene.add(new HemisphereLight("#fff4e6", "#3a3f4a", 1.1))
  const sun = new DirectionalLight("#fff1dc", 2.2)
  sun.position.set(-5, 11, 9)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun)

  // ---------------------------------------------------------------- models
  const kit = createShopKit()
  const floorCfg = { width: 12, depth: 10 }
  const floor = createShopFloor(kit, floorCfg)
  scene.add(floor.root)

  const place = <M extends AnyModel>(m: M, x: number, z: number, rotY = 0): M => {
    m.root.position.set(x, 0, z)
    m.root.rotation.y = rotY
    scene.add(m.root)
    m.root.updateMatrixWorld(true)
    return m
  }

  const hw = floorCfg.width / 2
  const hd = floorCfg.depth / 2
  const backZ = -hd + WALL_T + 0.25 + 0.02
  const shelves = [
    place(createModularShelf(kit, { bays: 2, stock: 0.9 }), -3.1, backZ),
    place(createModularShelf(kit, { bays: 2, levels: 5, stock: 0.7 }), -0.4, backZ),
    place(createModularShelf(kit, { bays: 2, height: 1.4, levels: 3, backPanel: false, depth: 0.6, stock: 0.8 }), -1.75, -1.4),
    place(createModularShelf(kit, { bays: 3, stock: 0.6 }), -hw + WALL_T + 0.27, 0.9, Math.PI / 2),
  ]
  const bench = place(createRepairBench(kit, { vise: "right" }), 3.4, -hd + WALL_T + 0.375 + 0.03)
  const counter = place(createCheckoutCounter(kit, { registerSide: "right" }), 2.6, 2.1)
  const models: AnyModel[] = [floor, ...shelves, bench, counter]

  // Consumer-owned light parented to the lamp's stable anchor (survives rebuilds).
  const lampLight = new PointLight("#ffb45a", 3, 3.5, 1.6)
  lampLight.userData.vibe3dRole = "lamp.light"
  lampLight.userData.excludeFromExport = true
  lampLight.position.set(-0.4, 1.15, -0.075)
  bench.parts.lamp.anchor.add(lampLight)
  bench.actions.setLamp(false)

  const socketWorld = (m: AnyModel, name: string) => m.sockets[name].anchor.getWorldPosition(new Vector3())

  // ---------------------------------------------------------------- navigation
  const nav = new NavGrid(-hw, -hd, hw, hd, 0.2)
  const AGENT_R = 0.24
  nav.blockRect(-hw, -hd, hw, -hd + WALL_T, AGENT_R)
  nav.blockRect(-hw, -hd, -hw + WALL_T, hd, AGENT_R)
  nav.blockBorder(AGENT_R)
  const tmpBox = new Box3()
  for (const m of models.slice(1)) {
    tmpBox.setFromObject(m.root)
    nav.blockRect(tmpBox.min.x, tmpBox.min.z, tmpBox.max.x, tmpBox.max.z, AGENT_R)
  }

  // ---------------------------------------------------------------- player
  const player = new Pawn({ body: "#e8e1d4", apron: "#2f6f6a" })
  player.root.name = "app/player"
  const entrance = socketWorld(floor, "entrance")
  player.root.position.copy(socketWorld(counter, "cashier"))
  scene.add(player.root)

  // ---------------------------------------------------------------- floating labels
  const labels: { el: HTMLElement; at: Vector3; t: number }[] = []
  const popup = (at: Vector3, text: string, tone: "gain" | "loss" | "info") => {
    const el = document.createElement("div")
    el.className = `pop pop-${tone}`
    el.textContent = text
    ui.overlay.appendChild(el)
    labels.push({ el, at: at.clone().setY(1.7), t: 0 })
  }

  // ---------------------------------------------------------------- game
  const shelfSlots: ShelfSlot[] = shelves.map((m, i) => ({
    id: `shelf-${i + 1}`,
    label: `Raf ${i + 1}`,
    model: m,
    spot: socketWorld(m, "front"),
    price: [8, 12, 6, 10][i],
  }))
  const game = new ShopGame({
    scene,
    nav,
    shelves: shelfSlots,
    queueHead: socketWorld(counter, "customer"),
    queueStep: new Vector3(0.55, 0, 0.42),
    waitingSpot: new Vector3(-1.4, 0, 3.6),
    entrance,
    say: ui.say,
    popup,
    onLamp: (on) => bench.actions.setLamp(on),
  })

  const placed: Placed[] = [
    ...shelfSlots.map((s) => ({
      id: s.id, label: s.label, model: s.model as AnyModel, socket: "front",
      interact: () => game.restock(s, player.root.position),
    })),
    {
      id: "bench", label: "Tamir masası", model: bench, socket: "work",
      interact: () => {
        if (!game.useBench()) {
          const on = bench.actions.toggleLamp()
          if (game.carry === null) ui.say(`Lamba ${on ? "açık" : "kapalı"}`)
        }
      },
    },
    {
      id: "counter", label: "Kasa", model: counter, socket: "cashier",
      interact: () => { counter.actions.ring(); game.serveAtCounter(player.root.position) },
    },
  ]

  // ---------------------------------------------------------------- markers
  const marker = new Mesh(new RingGeometry(0.16, 0.22, 32), new MeshBasicMaterial({ color: "#5fe3ff", transparent: true, opacity: 0 }))
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.03
  marker.userData.excludeFromExport = true
  scene.add(marker)
  let markerT = 0
  const flashMarker = (x: number, z: number, color: string) => {
    marker.position.set(x, 0.03, z)
    ;(marker.material as MeshBasicMaterial).color.set(color)
    markerT = 1
  }
  const hoverBox = new Box3Helper(new Box3(), new Color("#ffb347"))
  hoverBox.visible = false
  hoverBox.userData.excludeFromExport = true
  scene.add(hoverBox)

  // ---------------------------------------------------------------- camera
  const rig = new IsoCameraRig(container.clientWidth / container.clientHeight)
  rig.focus.copy(player.root.position)
  rig.snap()

  // ---------------------------------------------------------------- movement
  const walkTo = (x: number, z: number, then: (() => void) | null = null): boolean => {
    game.leaveBench()
    const ok = player.goTo(nav, x, z, then)
    if (!ok) { ui.say("Oraya gidilemiyor"); flashMarker(x, z, "#ff6b5f"); return false }
    const end = player.destination ?? player.root.position
    flashMarker(end.x, end.z, "#5fe3ff")
    rig.follow = true
    return true
  }

  const interactWith = (p: Placed): boolean => {
    const s = socketWorld(p.model, p.socket)
    return walkTo(s.x, s.z, () => {
      player.faceTowards(p.model.root.getWorldPosition(new Vector3()))
      p.interact()
    })
  }

  // ---------------------------------------------------------------- input
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0)
  const el = renderer.domElement
  const setRay = (x: number, y: number) => {
    const r = el.getBoundingClientRect()
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, rig.camera)
  }
  const pickPlaced = (): Placed | null => {
    let best: { p: Placed; d: number } | null = null
    for (const p of placed) {
      const hit = raycaster.intersectObject(p.model.root, true)[0]
      if (hit && (!best || hit.distance < best.d)) best = { p, d: hit.distance }
    }
    return best?.p ?? null
  }

  // Pointer tracking supports mouse (left click / right-drag pan) and touch (tap, 2-finger pan + pinch).
  const pointers = new Map<number, { x: number; y: number }>()
  let drag: { x: number; y: number; button: number; moved: boolean; multi: boolean } | null = null
  let pinch: { dist: number; mid: { x: number; y: number } } | null = null
  const twoFinger = () => {
    const [a, b] = [...pointers.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }

  el.addEventListener("contextmenu", (e) => e.preventDefault())
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      pinch = twoFinger()
      if (drag) drag.multi = true
    } else {
      drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false, multi: false }
    }
  })
  el.addEventListener("pointermove", (e) => {
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
    const p = pickPlaced()
    hoverBox.visible = !!p
    if (p) hoverBox.box.setFromObject(p.model.root)
    el.style.cursor = p ? "pointer" : "crosshair"
  })
  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = null
    const d = drag
    if (pointers.size > 0) return
    drag = null
    if (!d || d.moved || d.multi || d.button !== 0 || e.type === "pointercancel") return
    setRay(e.clientX, e.clientY)
    const p = pickPlaced()
    if (p) { interactWith(p); return }
    const hit = raycaster.ray.intersectPlane(groundPlane, new Vector3())
    if (hit) walkTo(hit.x, hit.z)
  }
  el.addEventListener("pointerup", endPointer)
  el.addEventListener("pointercancel", endPointer)
  el.addEventListener("wheel", (e) => {
    e.preventDefault()
    rig.zoomBy(Math.exp(e.deltaY * 0.0012))
  }, { passive: false })
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === "q") rig.rotateStep(-1)
    else if (k === "e") rig.rotateStep(1)
    else if (k === "f" || k === " ") { rig.follow = true; ui.say("Kamera karakteri takip ediyor") }
    else if (k === "c") { rig.follow = !rig.follow; ui.say(rig.follow ? "Takip açık" : "Serbest kamera") }
  }
  addEventListener("keydown", onKey)

  const resize = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h)
    rig.setAspect(w / h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  // ---------------------------------------------------------------- loop
  let last = performance.now()
  let raf = 0
  let hudT = 0
  const proj = new Vector3()
  /** Everything that advances game time; rendering and UI stay in tick(). */
  const simulate = (dt: number) => {
    player.update(dt)
    game.update(dt, player.moving)
    player.setCarry(game.carry === "broken" ? "#e0822c" : game.carry === "fixed" ? "#6fcf7c" : null)
    for (const m of models) m.update(dt)
  }
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    simulate(dt)

    if (markerT > 0) {
      markerT = Math.max(0, markerT - dt * 1.2)
      ;(marker.material as MeshBasicMaterial).opacity = markerT
      marker.scale.setScalar(1 + (1 - markerT) * 0.6)
    }

    if (rig.follow) rig.focus.lerp(new Vector3(player.root.position.x, 0, player.root.position.z), 1 - Math.exp(-dt * 5))
    rig.update(dt)
    renderer.render(scene, rig.camera)

    // Floating labels rise and fade over 1.4 s.
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i]
      l.t += dt / 1.4
      if (l.t >= 1) { l.el.remove(); labels.splice(i, 1); continue }
      proj.copy(l.at).setY(l.at.y + l.t * 0.8).project(rig.camera)
      l.el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * el.clientWidth}px, ${(-proj.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%, -50%)`
      l.el.style.opacity = String(1 - l.t * l.t)
    }

    hudT -= dt
    if (hudT <= 0) { ui.hud(game.hud()); hudT = 0.1 }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  ui.say("Dükkan açıldı. Müşterileri kasada karşıla")

  return {
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      removeEventListener("keydown", onKey)
      game.dispose()
      player.dispose()
      disposePawnAssets()
      labels.forEach((l) => l.el.remove())
      for (const m of models) m.dispose()
      kit.dispose()
      marker.geometry.dispose()
      ;(marker.material as MeshBasicMaterial).dispose()
      hoverBox.dispose()
      renderer.dispose()
      el.remove()
    },
    debug: {
      walkTo: (x, z) => walkTo(x, z),
      interact: (id) => { const p = placed.find((q) => q.id === id); return p ? interactWith(p) : false },
      setView({ yawStep, zoom, focus }) {
        if (yawStep) rig.rotateStep(yawStep)
        if (zoom) rig.zoom = zoom
        if (focus) { rig.follow = false; rig.focus.set(focus[0], 0, focus[1]) }
        rig.snap()
      },
      get pawn() { return player.root },
      game,
      fastForward(seconds, step = 1 / 30) {
        for (let t = 0; t < seconds; t += step) simulate(step)
      },
    },
  }
}
