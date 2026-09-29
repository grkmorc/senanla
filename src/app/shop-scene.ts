/**
 * Consumer scene: isometric shop built from @shop-kit models.
 * The app owns renderer, camera, loop, navigation and input (Vibe3D consumer role).
 * The pawn is an app-level placeholder, not a registry model (characters are out
 * of scope for vibe-model).
 */
import {
  WebGLRenderer, Scene, OrthographicCamera, Color, HemisphereLight, DirectionalLight, PointLight,
  Vector2, Vector3, Raycaster, Plane, Group, Mesh, CapsuleGeometry, MeshStandardMaterial,
  RingGeometry, MeshBasicMaterial, Box3, Box3Helper, Object3D, ACESFilmicToneMapping,
  PCFShadowMap, SRGBColorSpace, SphereGeometry, CylinderGeometry, DoubleSide, MathUtils,
} from "three"
import { createShopKit } from "@/kits/shop-kit/context"
import { createShopFloor, WALL_T } from "@/models/shop-kit/shop-floor"
import { createModularShelf } from "@/models/shop-kit/modular-shelf"
import { createRepairBench } from "@/models/shop-kit/repair-bench"
import { createCheckoutCounter } from "@/models/shop-kit/checkout-counter"
import type { ModelInstance } from "@/lib/vibe3d/model"
import { NavGrid } from "./nav-grid"
import { IsoCameraRig } from "./iso-camera"

type AnyModel = ModelInstance<any, any, any>

interface Placed {
  id: string
  label: string
  model: AnyModel
  /** Socket the pawn walks to before interacting. */
  socket: string
  interact?: () => string
}

export interface ShopSceneHandle {
  dispose(): void
  /** Test / automation hook. */
  readonly debug: {
    walkTo(x: number, z: number): boolean
    interact(id: string): boolean
    setView(opts: { yawStep?: number; zoom?: number; focus?: [number, number] }): void
    pawn: Object3D
  }
}

export function createShopScene(container: HTMLElement, hud?: (msg: string) => void): ShopSceneHandle {
  const say = hud ?? (() => {})

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

  const hemi = new HemisphereLight("#fff4e6", "#3a3f4a", 1.1)
  scene.add(hemi)
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

  const place = (m: AnyModel, x: number, z: number, rotY = 0) => {
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
    place(createModularShelf(kit, { bays: 2 }), -3.1, backZ),
    place(createModularShelf(kit, { bays: 2, levels: 5 }), -0.4, backZ),
    place(createModularShelf(kit, { bays: 2, height: 1.4, levels: 3, backPanel: false, depth: 0.6 }), -1.75, -1.4),
    place(createModularShelf(kit, { bays: 3, stock: 0.6 }), -hw + WALL_T + 0.27, 0.9, Math.PI / 2),
  ]
  const bench = place(createRepairBench(kit, { vise: "right" }), 3.4, -hd + WALL_T + 0.375 + 0.03)
  const counter = place(createCheckoutCounter(kit, { registerSide: "right" }), 2.6, 2.1)

  // Consumer-owned light parented to the lamp's stable anchor (survives rebuilds).
  const lampLight = new PointLight("#ffb45a", 3, 3.5, 1.6)
  lampLight.userData.vibe3dRole = "lamp.light"
  lampLight.userData.excludeFromExport = true
  lampLight.position.set(-0.4, 1.15, -0.075)
  bench.parts.lamp.anchor.add(lampLight)

  const placed: Placed[] = [
    ...shelves.map((m, i) => ({ id: `shelf-${i + 1}`, label: `Raf ${i + 1}`, model: m, socket: "front" })),
    {
      id: "bench", label: "Tamir masası", model: bench, socket: "work",
      interact: () => `Lamba ${bench.actions.toggleLamp() ? "açık" : "kapalı"}`,
    },
    {
      id: "counter", label: "Kasa", model: counter, socket: "cashier",
      interact: () => { counter.actions.ring(); return "Kasa açıldı" },
    },
  ]

  // ---------------------------------------------------------------- navigation
  const nav = new NavGrid(-hw, -hd, hw, hd, 0.2)
  const AGENT_R = 0.24
  // Walls from the floor definition.
  nav.blockRect(-hw, -hd, hw, -hd + WALL_T, AGENT_R)
  nav.blockRect(-hw, -hd, -hw + WALL_T, hd, AGENT_R)
  nav.blockBorder(AGENT_R) // keep the agent off the slab edge
  const tmpBox = new Box3()
  for (const p of placed) {
    tmpBox.setFromObject(p.model.root)
    nav.blockRect(tmpBox.min.x, tmpBox.min.z, tmpBox.max.x, tmpBox.max.z, AGENT_R)
  }

  // ---------------------------------------------------------------- pawn (placeholder)
  const pawn = new Group()
  pawn.name = "app/pawn"
  pawn.userData.excludeFromExport = true
  const pawnMat = new MeshStandardMaterial({ color: "#e8e1d4", roughness: 0.5 })
  const apronMat = new MeshStandardMaterial({ color: "#2f6f6a", roughness: 0.7 })
  const body = new Mesh(new CapsuleGeometry(0.2, 0.7, 6, 16), pawnMat)
  body.position.y = 0.55
  const apron = new Mesh(new CylinderGeometry(0.205, 0.215, 0.5, 16, 1, true, -Math.PI / 2.2, Math.PI / 1.1), apronMat)
  apron.material.side = DoubleSide
  apron.position.y = 0.5
  const head = new Mesh(new SphereGeometry(0.16, 20, 14), pawnMat)
  head.position.y = 1.18
  const nose = new Mesh(new SphereGeometry(0.045, 10, 8), apronMat)
  nose.position.set(0, 1.2, 0.15)
  for (const m of [body, apron, head, nose]) { m.castShadow = true; pawn.add(m) }
  const spawn = floor.sockets.entrance.anchor.getWorldPosition(new Vector3())
  pawn.position.copy(spawn)
  pawn.rotation.y = Math.PI
  scene.add(pawn)

  // Target marker.
  const marker = new Mesh(new RingGeometry(0.16, 0.22, 32), new MeshBasicMaterial({ color: "#5fe3ff", transparent: true, opacity: 0 }))
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.03
  marker.userData.excludeFromExport = true
  scene.add(marker)
  const hoverBox = new Box3Helper(new Box3(), new Color("#ffb347"))
  hoverBox.visible = false
  hoverBox.userData.excludeFromExport = true
  scene.add(hoverBox)

  // ---------------------------------------------------------------- camera
  const rig = new IsoCameraRig(container.clientWidth / container.clientHeight)
  rig.focus.copy(pawn.position)
  rig.snap()

  // ---------------------------------------------------------------- movement
  let path: Vector3[] = []
  let pending: Placed | null = null
  const SPEED = 2.6

  const walkTo = (x: number, z: number, then: Placed | null = null): boolean => {
    const route = nav.findPath(pawn.position.x, pawn.position.z, x, z)
    if (!route) { say("Oraya gidilemiyor"); flashMarker(x, z, "#ff6b5f"); return false }
    path = route.map(([px, pz]) => new Vector3(px, 0, pz))
    pending = then
    const end = path[path.length - 1] ?? pawn.position
    flashMarker(end.x, end.z, "#5fe3ff")
    rig.follow = true
    return true
  }

  let markerT = 0
  const flashMarker = (x: number, z: number, color: string) => {
    marker.position.set(x, 0.03, z)
    ;(marker.material as MeshBasicMaterial).color.set(color)
    markerT = 1
  }

  const interactWith = (p: Placed): boolean => {
    const s = p.model.sockets[p.socket].anchor.getWorldPosition(new Vector3())
    say(`${p.label} → yürünüyor`)
    return walkTo(s.x, s.z, p)
  }

  // ---------------------------------------------------------------- input
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0)
  const setNdc = (e: PointerEvent | MouseEvent) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
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

  let drag: { x: number; y: number; button: number; moved: boolean } | null = null
  const el = renderer.domElement
  el.addEventListener("contextmenu", (e) => e.preventDefault())
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId)
    drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false }
  })
  el.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (Math.hypot(dx, dy) > 4) drag.moved = true
      if (drag.moved && (drag.button === 2 || drag.button === 1 || (drag.button === 0 && e.shiftKey))) {
        rig.panPixels(dx, dy, el.clientHeight)
        drag.x = e.clientX
        drag.y = e.clientY
      }
      return
    }
    setNdc(e)
    const p = pickPlaced()
    if (p) {
      ;(hoverBox.box as Box3).setFromObject(p.model.root)
      hoverBox.visible = true
      el.style.cursor = "pointer"
    } else {
      hoverBox.visible = false
      el.style.cursor = "crosshair"
    }
  })
  el.addEventListener("pointerup", (e) => {
    const d = drag
    drag = null
    if (!d || d.moved || d.button !== 0) return
    setNdc(e)
    const p = pickPlaced()
    if (p) { interactWith(p); return }
    const hit = raycaster.ray.intersectPlane(groundPlane, new Vector3())
    if (hit) walkTo(hit.x, hit.z)
  })
  el.addEventListener("wheel", (e) => {
    e.preventDefault()
    rig.zoomBy(Math.exp(e.deltaY * 0.0012))
  }, { passive: false })
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === "q") rig.rotateStep(-1)
    else if (k === "e") rig.rotateStep(1)
    else if (k === "f" || k === " ") { rig.follow = true; say("Kamera karakteri takip ediyor") }
    else if (k === "c") { rig.follow = !rig.follow; say(rig.follow ? "Takip açık" : "Serbest kamera") }
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
  const models = [floor, ...shelves, bench, counter]
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    // Walk along the path.
    if (path.length) {
      const next = path[0]
      const to = new Vector3(next.x - pawn.position.x, 0, next.z - pawn.position.z)
      const dist = to.length()
      const step = SPEED * dt
      if (dist <= step) {
        pawn.position.x = next.x
        pawn.position.z = next.z
        path.shift()
      } else {
        to.multiplyScalar(step / dist)
        pawn.position.add(to)
      }
      const yaw = Math.atan2(to.x, to.z)
      pawn.rotation.y = lerpAngle(pawn.rotation.y, yaw, 1 - Math.exp(-dt * 14))
      pawn.position.y = Math.abs(Math.sin(now * 0.014)) * 0.04
      if (!path.length) {
        pawn.position.y = 0
        if (pending) {
          const target = pending
          pending = null
          // Face the model we came to use.
          const c = target.model.root.getWorldPosition(new Vector3())
          pawn.rotation.y = Math.atan2(c.x - pawn.position.x, c.z - pawn.position.z)
          say(target.interact ? target.interact() : `${target.label} incelendi`)
        }
      }
    }

    if (markerT > 0) {
      markerT = Math.max(0, markerT - dt * 1.2)
      ;(marker.material as MeshBasicMaterial).opacity = markerT
      marker.scale.setScalar(1 + (1 - markerT) * 0.6)
    }

    for (const m of models) m.update(dt)
    if (rig.follow) rig.focus.lerp(new Vector3(pawn.position.x, 0, pawn.position.z), 1 - Math.exp(-dt * 5))
    rig.update(dt)
    renderer.render(scene, rig.camera)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  say("Sol tık ile yürü; raf, tezgâh veya kasaya tıkla")

  return {
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      removeEventListener("keydown", onKey)
      for (const m of models) m.dispose()
      kit.dispose()
      pawn.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose() })
      pawnMat.dispose(); apronMat.dispose()
      marker.geometry.dispose(); (marker.material as MeshBasicMaterial).dispose()
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
      pawn,
    },
  }
}

function lerpAngle(a: number, b: number, t: number) {
  const d = MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI
  return a + d * t
}
