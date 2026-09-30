/**
 * Sokak: a living city block. Cars drive through a signalised intersection, pedestrians
 * use the sidewalks and zebra crossings. Your business lives here too: first a simit cart
 * on the sidewalk, later the shops along the street (empty ones carry a "for rent" plate).
 * There is no player on the street: you click the cart, your shop, or a shop for rent.
 * Trees, the vendor and crates are app-level set dressing.
 */
import {
  Scene, Vector3, PointLight, Mesh, Group, CylinderGeometry, IcosahedronGeometry, BoxGeometry,
  RingGeometry, CircleGeometry, MeshBasicMaterial,
  MeshStandardMaterial, MathUtils,
} from "three"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { ModelInstance } from "@/lib/vibe3d/model"
import { createStreetBlock, ROAD_Y } from "@/models/shop-kit/street-block"
import { createShopBuilding, type ShopBuildingConfig } from "@/models/shop-kit/shop-building"
import { createStreetLamp } from "@/models/shop-kit/street-lamp"
import { createStreetCart } from "@/models/shop-kit/street-cart"
import { createPlaza } from "@/models/shop-kit/plaza"
import { createFountain } from "@/models/shop-kit/fountain"
import { createParkBench } from "@/models/shop-kit/park-bench"
import { createPlanter } from "@/models/shop-kit/planter"
import { createTrafficLight, type TrafficLight } from "@/models/shop-kit/traffic-light"
import { createBarberPole } from "@/models/shop-kit/barber-pole"
import { SignFace } from "@/app/signage"
import { Atmosphere } from "@/app/atmosphere"
import { Pawn } from "@/app/pawn"
import { mulberry32, type Economy } from "@/game/economy"
import { CartStall } from "@/game/cart-stall"
import { TIERS, tierById, tierIndex, type TierId } from "@/game/career"
import { Traffic, SignalController, type Lane } from "@/sim/traffic"
import { Pedestrians, type Rect } from "@/sim/pedestrians"
import { socketWorld } from "./interior"
import { navFor, type Interactable, type Level, type LevelId, type WorldLabel } from "./level"
import { NEIGHBOUR_SIGNS, tierSign, type NeighbourShop } from "./shop-signs"
import { buildNeighbourhood, mountBuildingSign } from "./neighbourhood"

type AnyModel = ModelInstance<any, any, any>

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
  /** The career business this building houses, if any. */
  role?: TierId
  /** Neighbour's trade, painted on the sign board. */
  shop?: NeighbourShop
  x: number
  side: "n" | "s"
  config: Partial<ShopBuildingConfig>
}

const FRONTAGES: Frontage[] = [
  // Career businesses along the north side, smallest first.
  // Career businesses along the north side, around Simitçi Meydanı (x -13.5 … -3.5).
  { role: "kiosk", x: -17, side: "n", config: { width: 5.5, depth: 5.5, facade: "plaster", awning: "amber" } },
  { role: "grocery", x: 2, side: "n", config: { width: 8.5, depth: 7, facade: "plaster", awning: "teal", upperFloors: 1 } },
  { role: "supermarket", x: 16.5, side: "n", config: { width: 12, depth: 9, facade: "metal", awning: "none", shutter: true } },
  // Neighbours. (The north-east corner shop and the lot at x -30 across the road belong
  // to the growing neighbourhood, see ./neighbourhood.)
  { shop: "berber", x: -24, side: "n", config: { width: 8, depth: 8, facade: "brick", awning: "none", upperFloors: 2 } },
  { shop: "firin", x: -34.5, side: "n", config: { width: 8, depth: 7, facade: "plaster", awning: "amber", upperFloors: 1 } },
  { shop: "eczane", x: -45, side: "n", config: { width: 9, depth: 9, facade: "plaster", awning: "none", upperFloors: 3 } },
  { shop: "kasap", x: 42, side: "n", config: { width: 9, depth: 8, facade: "brick", awning: "red", upperFloors: 2 } },
  { shop: "kahvehane", x: -42, side: "s", config: { width: 10, depth: 9, facade: "brick", awning: "none", upperFloors: 3 } },
  { role: "restaurant", x: -19.5, side: "s", config: { width: 7.5, depth: 7, facade: "brick", awning: "red", upperFloors: 1 } },
  { role: "tech", x: 42.5, side: "s", config: { width: 9, depth: 8, facade: "plaster", awning: "none", upperFloors: 2 } },
  { shop: "terzi", x: 52.5, side: "s", config: { width: 8, depth: 9, facade: "brick", awning: "none", upperFloors: 3 } },
]

export interface OutdoorLevel extends Level {
  stall: CartStall
}

export function createOutdoorLevel(
  kit: ShopKit, eco: Economy, go: (to: LevelId) => void, windowGlass: MeshStandardMaterial,
  openCareer: (focus: TierId) => void,
  news: (title: string, body: string) => void = () => {},
): OutdoorLevel {
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
    if (x > -13.5 && x < -3.5 && z > -9 && z < 0) return 0.035 // Simitçi Meydanı paving
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
  const shops = buildings.filter((b) => b.f.role)

  // Painted signs: neighbours show their trade, career buildings follow your progress.
  const signFaces: SignFace[] = []
  const careerSigns = shops.map(({ f, model }) => {
    const face = mountBuildingSign(model)
    signFaces.push(face)
    return { id: f.role!, face }
  })
  for (const { f, model } of buildings) {
    if (!f.shop) continue
    const face = mountBuildingSign(model)
    face.set(NEIGHBOUR_SIGNS[f.shop])
    signFaces.push(face)
  }
  // A spinning pole by the barber's door, a blade sign sticking out of the pharmacy.
  const barber = buildings.find((b) => b.f.shop === "berber")!
  const pole = place(createBarberPole(kit), barber.f.x + 1.05, NORTH_FRONT)
  pole.root.position.y = 1.15
  const pharmacy = buildings.find((b) => b.f.shop === "eczane")!
  const blade = new Group()
  blade.userData.excludeFromExport = true
  for (const side of [1, -1]) {
    const face = new SignFace(1.1, 0.55)
    face.set({ text: "Eczane", bg: "#f7f4ef", fg: "#c62828", accent: "#c62828", icon: "cross" })
    face.mesh.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
    face.mesh.position.x = side * 0.021
    blade.add(face.mesh)
    signFaces.push(face)
  }
  const bladeBoard = new Mesh(new BoxGeometry(0.04, 0.62, 1.18), new MeshStandardMaterial({ color: "#c62828", roughness: 0.5 }))
  blade.add(bladeBoard)
  blade.position.set(pharmacy.f.x + (pharmacy.f.config.width ?? 8) / 2 - 0.9, 3.2, NORTH_FRONT + 0.72)
  scene.add(blade)

  // ---------------------------------------------------------------- Simitçi Meydanı
  // A small paved square between the kiosk and the grocery, with the cart at its front.
  const PLAZA = new Vector3(-8.5, 0, -4.5)
  const FOUNTAIN = new Vector3(-8.5, 0, -5.8)
  place(createPlaza(kit, { width: 10, depth: 9, ring: 2.15, ringZ: FOUNTAIN.z - PLAZA.z }), PLAZA.x, PLAZA.z)
  const fountain = place(createFountain(kit, { radius: 1.5 }), FOUNTAIN.x, FOUNTAIN.z)
  const benches = [
    place(createParkBench(kit), -12.3, -5.6, Math.PI / 2),
    place(createParkBench(kit), -4.7, -5.6, -Math.PI / 2),
    place(createParkBench(kit), -8.5, -8.35),
  ]
  const planterSpots: [number, number][] = [[-12.7, -1.0], [-4.3, -1.0], [-12.7, -8.3], [-4.3, -8.3]]
  const planters = planterSpots.map(([x, z]) => place(createPlanter(kit, { size: 1.0, height: 0.45 }), x, z))

  // The simit cart at the front of the square, a vendor behind it and a stack of crates.
  const CART = new Vector3(-8.5, 0, -1.3)
  const cart = place(createStreetCart(kit), CART.x, CART.z)
  cart.root.position.y = 0.035 // stands on the plaza paving
  const vendor = new Pawn({ skin: "#e8c4a0", shirt: "#ece6da", pants: "#3a3f4a", hair: "#2a1d16", apron: "#c8553d" }, 0)
  vendor.root.position.set(CART.x, 0, CART.z - 0.78)
  scene.add(vendor.root)
  const crateMat = new MeshStandardMaterial({ color: "#b98b52", roughness: 0.8 })
  const crateGeo = new BoxGeometry(0.55, 0.36, 0.42)
  const crates = new Group()
  crates.userData.excludeFromExport = true
  ;[[0, 0.18, 0, 0], [0.04, 0.54, 0.02, 0.2], [0.6, 0.18, -0.02, -0.1]].forEach(([x, y, z, r]) => {
    const m = new Mesh(crateGeo, crateMat)
    m.position.set(x, y, z)
    m.rotation.y = r
    m.castShadow = m.receiveShadow = true
    crates.add(m)
  })
  crates.position.set(CART.x - 1.55, 0.035, CART.z - 0.35)
  scene.add(crates)
  vendor.root.position.y = 0.035

  // A soft pulsing halo under the cart so it reads as "yours" from any zoom.
  const haloMat = new MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.5, depthWrite: false })
  const glowMat = new MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.12, depthWrite: false })
  const halo = new Group()
  halo.userData.excludeFromExport = true
  const ring = new Mesh(new RingGeometry(1.35, 1.55, 48), haloMat)
  const disc = new Mesh(new CircleGeometry(1.35, 48), glowMat)
  ring.rotation.x = disc.rotation.x = -Math.PI / 2
  halo.add(ring, disc)
  halo.position.set(CART.x, 0.045, CART.z + 0.1)
  scene.add(halo)
  let haloT = 0

  // Street lamps along every kerb.
  const lampSpots: [number, number][] = [
    ...[-50, -38, -29, -13.9, -3.1, 8.5, 21, 44, 55].map((x) => [x, R0 - 0.55] as [number, number]),
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
  for (let i = 0; i < 44; i++) treeSpots.push([-15 + rng() * 39, 15 + rng() * 21])
  for (let x = -50; x <= 20; x += 6.5) treeSpots.push([x + (rng() - 0.5) * 2, -14 - rng() * 8])
  for (let x = 40; x <= 54; x += 6) treeSpots.push([x + (rng() - 0.5) * 2, -14 - rng() * 6])
  for (let x = -52; x <= -14; x += 7) treeSpots.push([x + (rng() - 0.5), 26 + rng() * 6])
  const trees: [number, number][] = []
  const plantTree = (x: number, y: number, z: number, scale: number) => {
    const t = new Group()
    const trunk = new Mesh(trunkGeo, trunkMat)
    trunk.position.y = 0.7
    trunk.castShadow = true
    t.add(trunk)
    for (let i = 0; i < 3; i++) {
      const c = new Mesh(crownGeo, leafMats[Math.floor(rng() * leafMats.length)])
      c.position.set((rng() - 0.5) * 0.4 * scale, 1.7 * scale + i * 0.45 * scale, (rng() - 0.5) * 0.4 * scale)
      c.scale.setScalar(scale * (0.95 - i * 0.2))
      c.rotation.set(rng() * 3, rng() * 3, 0)
      c.castShadow = true
      c.receiveShadow = true
      t.add(c)
    }
    t.position.set(x, y, z)
    treeGroup.add(t)
  }
  // The growing neighbourhood: park, playground, halı saha, new shops and buildings.
  const growth = buildNeighbourhood({
    kit, scene, place, eco, rng: mulberry32(99), plantTree: (x, y, z, sc) => plantTree(x, y, z, sc),
    southEdge: S1, roadWestEdge: Q0 - SW, news, say: (m) => eco.notify.say(m),
    popup: (at, text) => eco.notify.popup(at, text, "info", "outdoor"),
  })

  const free = (x: number, z: number) => !growth.reserved.some(([x0, z0, x1, z1]) => x > x0 - 1 && x < x1 + 1 && z > z0 - 1 && z < z1 + 1)
  for (const p of planters) {
    const at = p.sockets.plant.anchor.getWorldPosition(new Vector3())
    plantTree(at.x, at.y - 0.3, at.z, 0.75)
  }
  for (const [x, z] of treeSpots) {
    if (!free(x, z)) continue
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
    [...buildings.map((b) => b.model), cart, fountain, ...benches, ...planters, ...lamps, ...heads.map((h) => h.model)].map((m) => m.root).concat(crates), 0.26, 0.35,
    [...roadBlocks, ...growth.blockers, ...trees.map(([x, z]) => [x - 0.2, z - 0.2, x + 0.2, z + 0.2] as [number, number, number, number])])

  const walkways: Rect[] = [
    [-W / 2 + 1, S0 + 0.3, W / 2 - 1, R0 - 0.45],
    [-W / 2 + 1, R1 + 0.45, W / 2 - 1, S1 - 0.3],
    [Q0 - SW + 0.3, -D / 2 + 1, Q0 - 0.45, S0],
    [Q1 + 0.45, -D / 2 + 1, Q1 + SW - 0.3, S0],
    [Q0 - SW + 0.3, S1, Q0 - 0.45, D / 2 - 1],
    [Q1 + 0.45, S1, Q1 + SW - 0.3, D / 2 - 1],
    ...growth.walkways, // park
    [-13, -8.8, -4, -0.6], // Simitçi Meydanı
  ]
  const people = new Pedestrians(scene, nav, walkways, rng, growth.population(), groundAt)
  let syncedDay = eco.day

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
    signFaces.forEach((f) => f.setGlow(k))
    growth.setNight(k, t > 0.55)
  }

  // ---------------------------------------------------------------- the cart business
  // Customers step out of neighbouring doors and the street corners.
  const origins = buildings.filter((b) => !b.f.role && b.f.side === "n").map((b) => socketWorld(b.model, "door"))
    .concat([new Vector3(-24, 0, 1.6), new Vector3(8, 0, 1.6), new Vector3(-2, 0, 11.5), new Vector3(-12, 0, 11.5)])
  const stall = new CartStall(eco, {
    scene, nav, entrance: new Vector3(),
    queueHead: socketWorld(cart, "customer"), queueStep: new Vector3(0.75, 0, 0.06), queueFacing: new Vector3(0, 0, -1),
    rng: mulberry32(777),
  }, cart, origins)

  // ---------------------------------------------------------------- interaction
  const interactables: Interactable[] = []
  const cartThings: Interactable[] = [
    {
      id: "cart", get label() { return `Tezgâh · sat (${stall.stock}/${stall.capacity} simit)` }, pick: cart.root,
      spot: () => CART, face: () => CART, interact: () => stall.serve(),
    },
    {
      id: "crates", get label() { return stall.restockCost ? `Mal al · ₺${stall.restockCost}` : "Tezgâh dolu" }, pick: crates,
      spot: () => CART, face: () => CART, interact: () => stall.restock(),
    },
  ]
  const levelOf: Partial<Record<TierId, LevelId>> = { kiosk: "kiosk", grocery: "grocery" }
  const shortName = (id: TierId) => tierById(id).name
  const shopThings = shops.map(({ f, model }): Interactable => {
    const id = f.role!
    return {
      id,
      get label() {
        const t = tierById(id)
        if (id === eco.tier) return `${t.name} · içeri gir`
        if (!t.ready) return `${t.name} · yakında`
        return tierIndex(id) > tierIndex(eco.tier) ? `Kiralık · ${t.name} için ₺${t.cost.toLocaleString("tr-TR")}` : "Eski dükkanın"
      },
      pick: model.root,
      spot: () => socketWorld(model, "door"),
      face: () => model.root.position,
      interact: () => {
        const lv = levelOf[id]
        if (id === eco.tier && lv) go(lv)
        else if (tierIndex(id) > tierIndex(eco.tier)) openCareer(id)
      },
    }
  })
  const plateColor = (id: TierId) => TIERS.find((t) => t.id === id)!.color
  const labels: WorldLabel[] = [
    {
      get text() { return stall.queueLength ? `SİMİT TEZGÂHIN · ${stall.queueLength} müşteri` : "SİMİT TEZGÂHIN" },
      at: CART.clone().setY(3.15), color: plateColor("cart"),
      get kind() { return eco.tier === "cart" ? "main" as const : "hidden" as const },
      get alert() { return stall.queueLength > 0 },
    },
    ...shops.map(({ f, model }): WorldLabel => {
      const id = f.role!
      return {
        get text() {
          const t = tierById(id)
          if (id === eco.tier) return t.name.toLocaleUpperCase("tr")
          if (!t.ready) return `YAKINDA · ${shortName(id).toLocaleUpperCase("tr")}`
          return `KİRALIK · ₺${t.cost.toLocaleString("tr-TR")}`
        },
        // Above the roofline, so the painted sign board stays readable.
        at: (() => {
          const c = model.getConfig()
          return socketWorld(model, "sign").setY(c.height + c.upperFloors * 3 + 1.1)
        })(),
        color: plateColor(id),
        get kind() {
          if (id === eco.tier) return "own" as const
          if (tierIndex(id) < tierIndex(eco.tier)) return "hidden" as const
          return tierById(id).ready ? "rent" as const : "soon" as const
        },
      }
    }),
  ]

  // Rebuild the clickable set and the cart's presence whenever the business changes.
  const applyTier = () => {
    const onCart = eco.tier === "cart"
    stall.active = onCart
    if (!onCart) stall.clear()
    cart.root.visible = vendor.root.visible = crates.visible = halo.visible = onCart
    careerSigns.forEach(({ id, face }) => face.set(tierSign(id, eco.tier)))
    interactables.length = 0
    if (onCart) interactables.push(...cartThings)
    interactables.push(...shopThings.filter((it) => tierIndex(it.id as TierId) >= tierIndex(eco.tier)))
  }
  // Repaint the signs once the display font has arrived.
  document.fonts?.ready.then(() => [...signFaces, ...growth.signs].forEach((f) => f.refresh()))
  eco.onTierChange(applyTier)
  applyTier()

  const focusFor = (from: LevelId | null) => {
    const id: TierId = from === "kiosk" ? "kiosk" : from === "grocery" ? "grocery" : eco.tier
    if (id === "cart") return CART.clone().setZ(CART.z + 1.8)
    const b = shops.find((s) => s.f.role === id)
    return new Vector3(b ? b.f.x : 0, 0, 3)
  }

  return {
    id: "outdoor",
    title: "Sokak",
    walkable: false,
    scene,
    nav,
    bounds: { minX: -46, maxX: 50, minZ: -28, maxZ: 34 },
    zoom: { get initial() { return eco.tier === "cart" ? 7.5 : 13 }, min: 4, max: 30 },
    interactables,
    labels,
    groundAt,
    arrival: (from) => {
      const p = focusFor(from)
      return { pos: p, face: p.clone().setZ(p.z + 1) }
    },
    cameraFocus: focusFor,
    stall,
    update(dt) {
      haloT += dt
      const k = 0.5 + 0.5 * Math.sin(haloT * 2.6)
      ring.scale.setScalar(1 + k * 0.08)
      haloMat.opacity = 0.35 + k * 0.35
      stall.update(dt)
      vendor.update(dt)
      signals.update(dt)
      for (const h of heads) h.model.actions.setSignal(signals.of(h.group))
      if (eco.day !== syncedDay) {
        // A day went by: announce what opened. (Jumps, e.g. a reset, update quietly.)
        growth.sync(eco.day !== syncedDay + 1)
        people.setCount(growth.population())
        syncedDay = eco.day
      }
      growth.update(dt)
      people.update(dt)
      traffic.update(dt, people.positions())
      for (const m of models) m.update(dt)
    },
    setDayProgress(t) { atmosphere.setDayProgress(t) },
    moods: () => stall.moods(),
    work: () => null,
    debug: { traffic, people, signals, stall, growth },
    dispose() {
      growth.dispose()
      signFaces.forEach((f) => f.dispose())
      bladeBoard.geometry.dispose(); (bladeBoard.material as MeshStandardMaterial).dispose()
      traffic.dispose()
      people.dispose()
      stall.dispose()
      vendor.dispose()
      crateGeo.dispose(); crateMat.dispose()
      ring.geometry.dispose(); disc.geometry.dispose(); haloMat.dispose(); glowMat.dispose()
      models.forEach((m) => m.dispose())
      atmosphere.dispose()
      trunkGeo.dispose(); crownGeo.dispose(); trunkMat.dispose()
      leafMats.forEach((m) => m.dispose())
    },
  }
}
