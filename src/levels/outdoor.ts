/**
 * Sokak: a living city block around the three shops. Cars drive through a signalised
 * intersection, pedestrians use the sidewalks and zebra crossings, apartments and other
 * shops fill the street. There is no player here: click one of our shops to open it.
 * Trees are app-level set dressing (organic content is outside vibe-model's scope).
 */
import {
  Scene, Vector3, PointLight, Mesh, Group, CylinderGeometry, IcosahedronGeometry,
  MeshStandardMaterial, MathUtils,
} from "three"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { ModelInstance } from "@/lib/vibe3d/model"
import { createStreetBlock, ROAD_Y } from "@/models/shop-kit/street-block"
import { createShopBuilding, type ShopBuildingConfig } from "@/models/shop-kit/shop-building"
import { createStreetLamp } from "@/models/shop-kit/street-lamp"
import { createScrapPile } from "@/models/shop-kit/scrap-pile"
import { createTrafficLight, type TrafficLight } from "@/models/shop-kit/traffic-light"
import { Atmosphere } from "@/app/atmosphere"
import { mulberry32, type Economy } from "@/game/economy"
import { Traffic, SignalController, type Lane } from "@/sim/traffic"
import { Pedestrians, type Rect } from "@/sim/pedestrians"
import { socketWorld } from "./interior"
import { navFor, type Interactable, type Level, type LevelId, type WorldLabel } from "./level"

type AnyModel = ModelInstance<any, any, any>
type ShopId = Exclude<LevelId, "outdoor">

// ---------------------------------------------------------------- city layout
const W = 110
const D = 84
const ROAD_Z = 6.5
const RW = 7
const SW = 3
const CROSS_X = 30
const R0 = ROAD_Z - RW / 2 // 3
const R1 = ROAD_Z + RW / 2 // 10
const S0 = R0 - SW // 0
const S1 = R1 + SW // 13
const Q0 = CROSS_X - RW / 2 // 26.5
const Q1 = CROSS_X + RW / 2 // 33.5
const NORTH_FRONT = S0 - 0.1
const SOUTH_FRONT = S1 + 0.1

interface Frontage {
  id?: ShopId
  name?: string
  x: number
  side: "n" | "s"
  config: Partial<ShopBuildingConfig>
}

const FRONTAGES: Frontage[] = [
  // Our three shops, north side.
  { id: "repair", name: "TAMİRHANE", x: -12.5, side: "n", config: { width: 7.5, depth: 6.5, facade: "brick", awning: "amber" } },
  { id: "sales", name: "MAĞAZA", x: 0, side: "n", config: { width: 8.5, depth: 7, facade: "plaster", awning: "teal", upperFloors: 1 } },
  { id: "scrap", name: "HURDALIK", x: 12.5, side: "n", config: { width: 7.5, depth: 6.5, facade: "metal", awning: "red", shutter: true } },
  // Neighbours.
  { x: -24, side: "n", config: { width: 8, depth: 8, facade: "brick", awning: "none", upperFloors: 2 } },
  { x: -34.5, side: "n", config: { width: 8, depth: 7, facade: "plaster", awning: "amber", upperFloors: 1 } },
  { x: -45, side: "n", config: { width: 9, depth: 9, facade: "plaster", awning: "none", upperFloors: 3 } },
  { x: 42, side: "n", config: { width: 9, depth: 8, facade: "brick", awning: "red", upperFloors: 2 } },
  { x: 52, side: "n", config: { width: 7.5, depth: 7, facade: "plaster", awning: "teal", upperFloors: 1 } },
  { x: -42, side: "s", config: { width: 10, depth: 9, facade: "brick", awning: "none", upperFloors: 3 } },
  { x: -30, side: "s", config: { width: 9, depth: 8, facade: "plaster", awning: "none", upperFloors: 2 } },
  { x: -19.5, side: "s", config: { width: 7.5, depth: 7, facade: "brick", awning: "teal", upperFloors: 1 } },
  { x: 42.5, side: "s", config: { width: 9, depth: 8, facade: "plaster", awning: "amber", upperFloors: 2 } },
  { x: 52.5, side: "s", config: { width: 8, depth: 9, facade: "brick", awning: "none", upperFloors: 3 } },
]

export function createOutdoorLevel(kit: ShopKit, eco: Economy, go: (to: LevelId) => void, windowGlass: MeshStandardMaterial): Level {
  const scene = new Scene()
  const models: AnyModel[] = []
  const rng = mulberry32(4242)
  const place = <M extends AnyModel>(m: M, x: number, z: number, rotY = 0): M => {
    m.root.position.set(x, 0, z)
    m.root.rotation.y = rotY
    scene.add(m.root)
    m.root.updateMatrixWorld(true)
    models.push(m)
    return m
  }

  place(createStreetBlock(kit, { width: W, depth: D, roadZ: ROAD_Z, roadWidth: RW, sidewalk: SW, crossingX: 0, cross: true, crossX: CROSS_X }), 0, 0)
  const groundAt = (x: number, z: number) => {
    if (Math.abs(z - ROAD_Z) < RW / 2 || Math.abs(x - CROSS_X) < RW / 2) return ROAD_Y
    if (z > S1 && (x < Q0 - SW || x > Q1 + SW)) return -0.02
    return 0
  }

  // Buildings.
  const buildings = FRONTAGES.map((f) => {
    const depth = f.config.depth ?? 7
    const m = f.side === "n"
      ? place(createShopBuilding(kit, f.config), f.x, NORTH_FRONT - depth / 2)
      : place(createShopBuilding(kit, f.config), f.x, SOUTH_FRONT + depth / 2, Math.PI)
    return { f, model: m }
  })
  const shops = buildings.filter((b) => b.f.id)

  // Salvage beside the scrapyard.
  const junk = [
    place(createScrapPile(kit, { radius: 1.2, variant: 11 }), 18.6, -2.4),
    place(createScrapPile(kit, { radius: 0.9, variant: 23 }), 20.8, -5.6),
  ]

  // Street lamps along every kerb.
  const lampSpots: [number, number][] = [
    ...[-50, -38, -29, -6.3, 6.3, 18.5, 44, 55].map((x) => [x, R0 - 0.55] as [number, number]),
    ...[-47, -36, -24, -8, 6, 20, 47].map((x) => [x, R1 + 0.55] as [number, number]),
    ...[-12, -24, -36].map((z) => [Q0 - 0.55, z] as [number, number]),
    ...[22, 32].map((z) => [Q1 + 0.55, z] as [number, number]),
  ]
  const lamps = lampSpots.map(([x, z]) => place(createStreetLamp(kit), x, z))
  const lampLights = lamps.filter((_, i) => i % 2 === 0).map((l) => {
    const p = new PointLight("#ffd29a", 0, 10, 1.3)
    p.userData.excludeFromExport = true
    p.position.copy(l.sockets.light.anchor.position)
    l.parts.lantern.anchor.add(p)
    return p
  })

  // Signals: one head per approach, on the near-right corner, facing oncoming cars.
  const signals = new SignalController()
  const heads: { model: TrafficLight; group: "ew" | "ns" }[] = [
    { model: place(createTrafficLight(kit), Q0 - 0.6, R1 + 0.6, -Math.PI / 2), group: "ew" }, // eastbound
    { model: place(createTrafficLight(kit), Q1 + 0.6, R0 - 0.6, Math.PI / 2), group: "ew" }, // westbound
    { model: place(createTrafficLight(kit), Q0 - 0.6, R0 - 0.6, Math.PI), group: "ns" }, // southbound
    { model: place(createTrafficLight(kit), Q1 + 0.6, R1 + 0.6, 0), group: "ns" }, // northbound
  ]

  // Trees: park across the road, behind the shops, and along the verge.
  const treeGroup = new Group()
  treeGroup.userData.excludeFromExport = true
  const trunkGeo = new CylinderGeometry(0.1, 0.15, 1.4, 8)
  const crownGeo = new IcosahedronGeometry(1, 1)
  const trunkMat = new MeshStandardMaterial({ color: "#5a4030", roughness: 0.9 })
  const leafMats = ["#4f7a3f", "#5d8a45", "#6b8f3a", "#48703c"].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }))
  const treeSpots: [number, number][] = []
  for (let i = 0; i < 16; i++) treeSpots.push([-11 + rng() * 31, 16 + rng() * 14])
  for (let x = -50; x <= 20; x += 6.5) treeSpots.push([x + (rng() - 0.5) * 2, -14 - rng() * 8])
  for (let x = 40; x <= 54; x += 6) treeSpots.push([x + (rng() - 0.5) * 2, -14 - rng() * 6])
  for (let x = -52; x <= -14; x += 7) treeSpots.push([x + (rng() - 0.5), 26 + rng() * 6])
  const trees: [number, number][] = []
  for (const [x, z] of treeSpots) {
    const t = new Group()
    const trunk = new Mesh(trunkGeo, trunkMat)
    trunk.position.y = 0.7
    trunk.castShadow = true
    t.add(trunk)
    const s = 0.9 + rng() * 0.6
    for (let i = 0; i < 3; i++) {
      const c = new Mesh(crownGeo, leafMats[Math.floor(rng() * leafMats.length)])
      c.position.set((rng() - 0.5) * 0.6 * s, 1.7 * s + i * 0.45 * s, (rng() - 0.5) * 0.6 * s)
      c.scale.setScalar(s * (0.95 - i * 0.2))
      c.rotation.set(rng() * 3, rng() * 3, 0)
      c.castShadow = true
      c.receiveShadow = true
      t.add(c)
    }
    t.position.set(x, groundAt(x, z), z)
    treeGroup.add(t)
    trees.push([x, z])
  }
  scene.add(treeGroup)

  // ---------------------------------------------------------------- navigation (pedestrians)
  const area = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 }
  const roadBlocks: [number, number, number, number][] = [
    // E-W road, open only at the mid-block zebra and the two intersection arms.
    [-W / 2, R0, -2.2, R1], [2.2, R0, Q0 - SW, R1], [Q0, R0, Q1, R1], [Q1 + SW, R0, W / 2, R1],
    // N-S road, open only where it meets the E-W sidewalks.
    [Q0, -D / 2, Q1, S0], [Q0, S1, Q1, D / 2],
  ]
  const nav = navFor(area,
    [...buildings.map((b) => b.model), ...junk, ...lamps, ...heads.map((h) => h.model)].map((m) => m.root), 0.26, 0.35,
    [...roadBlocks, ...trees.map(([x, z]) => [x - 0.2, z - 0.2, x + 0.2, z + 0.2] as [number, number, number, number])])

  const walkways: Rect[] = [
    [-W / 2 + 1, S0 + 0.3, W / 2 - 1, R0 - 0.45],
    [-W / 2 + 1, R1 + 0.45, W / 2 - 1, S1 - 0.3],
    [Q0 - SW + 0.3, -D / 2 + 1, Q0 - 0.45, S0],
    [Q1 + 0.45, -D / 2 + 1, Q1 + SW - 0.3, S0],
    [Q0 - SW + 0.3, S1, Q0 - 0.45, D / 2 - 1],
    [Q1 + 0.45, S1, Q1 + SW - 0.3, D / 2 - 1],
    [-10, 15, 20, 30], // park
  ]
  const people = new Pedestrians(scene, nav, walkways, rng, 22, groundAt)

  // ---------------------------------------------------------------- traffic
  const E = 6 // lanes start/end this far outside the block
  const lane = (id: string, from: Vector3, dir: Vector3, length: number, stopWorld: number | null, group: "ew" | "ns"): Lane => {
    let stopAt: number | null = null
    if (stopWorld !== null) stopAt = Math.abs(dir.x) > 0 ? (stopWorld - from.x) * dir.x : (stopWorld - from.z) * dir.z
    return { id, from, dir, length, stopAt, group }
  }
  const lanes: Lane[] = [
    lane("eb", new Vector3(-W / 2 - E, ROAD_Y, ROAD_Z + 1.75), new Vector3(1, 0, 0), W + 2 * E, Q0 - SW - 0.65, "ew"),
    lane("wb", new Vector3(W / 2 + E, ROAD_Y, ROAD_Z - 1.75), new Vector3(-1, 0, 0), W + 2 * E, Q1 + SW + 0.65, "ew"),
    lane("sb", new Vector3(CROSS_X - 1.75, ROAD_Y, -D / 2 - E), new Vector3(0, 0, 1), D + 2 * E, S0 - 0.65, "ns"),
    lane("nb", new Vector3(CROSS_X + 1.75, ROAD_Y, D / 2 + E), new Vector3(0, 0, -1), D + 2 * E, S1 + 0.65, "ns"),
  ]
  const traffic = new Traffic(kit, scene, lanes, signals, rng, 18)

  // ---------------------------------------------------------------- lighting
  const atmosphere = new Atmosphere(scene, [], { shadowExtent: 60 })
  atmosphere.onProgress = (t) => {
    const k = MathUtils.smoothstep(t, 0.55, 0.95)
    windowGlass.emissiveIntensity = k * 1.4
    lampLights.forEach((p) => { p.intensity = k * 10 })
    lamps.forEach((l) => l.actions.setOn(t > 0.55))
  }

  // ---------------------------------------------------------------- interaction: shops only
  const shopHint: Record<ShopId, string> = { sales: "Mağaza", repair: "Tamirhane", scrap: "Hurdalık" }
  const interactables: Interactable[] = shops.map(({ f, model }) => ({
    id: f.id!,
    label: `${shopHint[f.id!]} · içeri gir`,
    pick: model.root,
    spot: () => socketWorld(model, "door"),
    face: () => model.root.position,
    interact: () => go(f.id!),
  }))
  const plate: Record<ShopId, string> = { sales: "#3fb3a3", repair: "#f0a53a", scrap: "#e0634e" }
  const labels: WorldLabel[] = shops.map(({ f, model }) => ({ text: f.name!, at: socketWorld(model, "sign"), color: plate[f.id!] }))

  const focusFor = (id: LevelId | null) => {
    const b = shops.find((s) => s.f.id === id)
    return new Vector3(b ? b.f.x : 0, 0, 3)
  }

  return {
    id: "outdoor",
    title: "Sokak",
    walkable: false,
    scene,
    nav,
    bounds: { minX: -46, maxX: 50, minZ: -28, maxZ: 34 },
    zoom: { initial: 13, min: 5, max: 30 },
    interactables,
    labels,
    groundAt,
    arrival: (from) => {
      const p = focusFor(from)
      return { pos: p, face: p.clone().setZ(p.z + 1) }
    },
    cameraFocus: focusFor,
    update(dt) {
      signals.update(dt)
      for (const h of heads) h.model.actions.setSignal(signals.of(h.group))
      people.update(dt)
      traffic.update(dt, people.positions())
      for (const m of models) m.update(dt)
    },
    setDayProgress(t) { atmosphere.setDayProgress(t) },
    moods: () => [],
    work: () => null,
    debug: { traffic, people, signals },
    dispose() {
      traffic.dispose()
      people.dispose()
      models.forEach((m) => m.dispose())
      atmosphere.dispose()
      trunkGeo.dispose(); crownGeo.dispose(); trunkMat.dispose()
      leafMats.forEach((m) => m.dispose())
      void eco
    },
  }
}
