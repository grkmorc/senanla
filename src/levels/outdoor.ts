/**
 * Dış dünya: one street with the three shops. Click a building to walk to its door and go in.
 * Trees and pedestrians are app-level set dressing (organic/character content is outside
 * vibe-model's hard-surface scope); everything built is from @shop-kit.
 */
import {
  Scene, Vector3, PointLight, Mesh, Group, CylinderGeometry, IcosahedronGeometry,
  MeshStandardMaterial, MathUtils, type Material,
} from "three"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { ModelInstance } from "@/lib/vibe3d/model"
import { createStreetBlock, ROAD_Y } from "@/models/shop-kit/street-block"
import { createShopBuilding, type ShopBuildingConfig } from "@/models/shop-kit/shop-building"
import { createStreetLamp } from "@/models/shop-kit/street-lamp"
import { createScrapPile } from "@/models/shop-kit/scrap-pile"
import { Atmosphere } from "@/app/atmosphere"
import { Pawn, CUSTOMER_LOOKS } from "@/app/pawn"
import { mulberry32, type Economy } from "@/game/economy"
import { socketWorld } from "./interior"
import { navFor, type Interactable, type Level, type LevelId, type WorldLabel } from "./level"

type AnyModel = ModelInstance<any, any, any>

interface Shopfront {
  id: Exclude<LevelId, "outdoor">
  name: string
  hint: string
  x: number
  config: Partial<ShopBuildingConfig>
}

const SHOPS: Shopfront[] = [
  { id: "repair", name: "TAMİRHANE", hint: "Arızalı cihazları onar", x: -12.5, config: { width: 7.5, depth: 6.5, facade: "brick", awning: "amber" } },
  { id: "sales", name: "MAĞAZA", hint: "Ürün sat, rafları doldur", x: 0, config: { width: 8.5, depth: 7, facade: "plaster", awning: "teal" } },
  { id: "scrap", name: "HURDALIK", hint: "Hurdadan yedek parça çıkar", x: 12.5, config: { width: 7.5, depth: 6.5, facade: "metal", awning: "red", shutter: true } },
]

const FRONT_Z = 0.4 // building facades line up here; the sidewalk starts at z = 1

export function createOutdoorLevel(kit: ShopKit, eco: Economy, go: (to: LevelId) => void, windowGlass: MeshStandardMaterial): Level {
  const scene = new Scene()
  const models: AnyModel[] = []
  const place = <M extends AnyModel>(m: M, x: number, z: number, rotY = 0): M => {
    m.root.position.set(x, 0, z)
    m.root.rotation.y = rotY
    scene.add(m.root)
    m.root.updateMatrixWorld(true)
    models.push(m)
    return m
  }

  const W = 48
  const D = 34
  const ROAD_Z = 6.5
  const ROAD_W = 6
  place(createStreetBlock(kit, { width: W, depth: D, roadZ: ROAD_Z, roadWidth: ROAD_W, sidewalk: 2.5, crossingX: 0 }), 0, 0)
  const groundAt = (_x: number, z: number) =>
    Math.abs(z - ROAD_Z) < ROAD_W / 2 ? ROAD_Y : z > ROAD_Z + ROAD_W / 2 + 2.5 ? -0.02 : 0

  const buildings = SHOPS.map((s) => {
    const depth = s.config.depth ?? 7
    return { shop: s, model: place(createShopBuilding(kit, s.config), s.x, FRONT_Z - depth / 2) }
  })

  // Decorative salvage next to the scrapyard.
  const junk = [
    place(createScrapPile(kit, { radius: 1.2, variant: 11 }), 18.8, -1.4),
    place(createScrapPile(kit, { radius: 0.9, variant: 23 }), 18.2, -4.6),
  ]

  // Street lamps along the kerb; they light up towards evening.
  const lampXs = [-19, -6.3, 6.3, 19]
  const lamps = lampXs.map((x) => place(createStreetLamp(kit), x, 3.05))
  const lampLights = lamps.map((l) => {
    const p = new PointLight("#ffd29a", 0, 9, 1.3)
    p.userData.excludeFromExport = true
    p.position.copy(l.sockets.light.anchor.position)
    l.parts.lantern.anchor.add(p)
    return p
  })

  // Trees: app-level set dressing on the verge and behind the shops.
  const treeGroup = new Group()
  treeGroup.userData.excludeFromExport = true
  const trunkGeo = new CylinderGeometry(0.1, 0.15, 1.4, 8)
  const crownGeo = new IcosahedronGeometry(1, 1)
  const trunkMat = new MeshStandardMaterial({ color: "#5a4030", roughness: 0.9 })
  const leafMats = ["#4f7a3f", "#5d8a45", "#6b8f3a"].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }))
  const rng = mulberry32(77)
  const treeSpots: [number, number][] = []
  for (let x = -21; x <= 21; x += 5.2) treeSpots.push([x + (rng() - 0.5) * 1.2, 14 + (rng() - 0.5) * 1.5])
  treeSpots.push([-7, -9.5], [6.5, -10], [-18, -8], [16.5, -9], [-2, -12.5], [11, -13])
  const trees: [number, number][] = []
  for (const [x, z] of treeSpots) {
    const t = new Group()
    const trunk = new Mesh(trunkGeo, trunkMat)
    trunk.position.y = 0.7
    trunk.castShadow = true
    t.add(trunk)
    const s = 0.9 + rng() * 0.5
    for (let i = 0; i < 3; i++) {
      const c = new Mesh(crownGeo, leafMats[Math.floor(rng() * leafMats.length)])
      c.position.set((rng() - 0.5) * 0.6 * s, 1.7 * s + i * 0.45 * s, (rng() - 0.5) * 0.6 * s)
      c.scale.setScalar(s * (0.95 - i * 0.2))
      c.rotation.set(rng() * 3, rng() * 3, 0)
      c.castShadow = true
      c.receiveShadow = true
      t.add(c)
    }
    t.position.set(x, z > 12 ? -0.02 : 0, z)
    treeGroup.add(t)
    trees.push([x, z])
  }
  scene.add(treeGroup)

  // Glowing shop windows in the evening (shared kit glass override owned by the app).
  const atmosphere = new Atmosphere(scene, [], { shadowExtent: 26 })
  atmosphere.onProgress = (t) => {
    const k = MathUtils.smoothstep(t, 0.55, 0.95)
    windowGlass.emissiveIntensity = k * 1.4
    lampLights.forEach((p) => { p.intensity = k * 9 })
    lamps.forEach((l) => l.actions.setOn(t > 0.55))
  }

  const area = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 }
  const nav = navFor(area, [...buildings.map((b) => b.model), ...junk, ...lamps].map((m) => m.root), 0.26, 0.25,
    trees.map(([x, z]) => [x - 0.2, z - 0.2, x + 0.2, z + 0.2] as [number, number, number, number]))

  // Pedestrians stroll along both sidewalks.
  const walkers: Pawn[] = []
  const lanes = [2.2, 10.9]
  for (let i = 0; i < 4; i++) {
    const p = new Pawn(CUSTOMER_LOOKS[(i * 2 + 1) % CUSTOMER_LOOKS.length], 1.3 + rng() * 0.4)
    p.root.position.set(-20 + rng() * 40, 0, lanes[i % 2])
    scene.add(p.root)
    walkers.push(p)
  }
  const stroll = (p: Pawn, lane: number) => {
    const x = p.root.position.x > 0 ? -21 + rng() * 6 : 15 + rng() * 6
    p.goTo(nav, x, lane + (rng() - 0.5) * 0.6, () => stroll(p, lane))
  }
  walkers.forEach((p, i) => stroll(p, lanes[i % 2]))

  const interactables: Interactable[] = buildings.map(({ shop, model }) => ({
    id: shop.id,
    label: `${shop.name.charAt(0)}${shop.name.slice(1).toLocaleLowerCase("tr")} (gir)`,
    pick: model.root,
    spot: () => socketWorld(model, "door").setZ(FRONT_Z + 0.7),
    face: () => socketWorld(model, "door").setZ(FRONT_Z - 1),
    interact: () => go(shop.id),
  }))

  const labels: WorldLabel[] = buildings.map(({ shop, model }) => ({ text: shop.name, at: socketWorld(model, "sign") }))

  return {
    id: "outdoor",
    title: "Sokak",
    scene,
    nav,
    bounds: { minX: -20, maxX: 20, minZ: -12, maxZ: 14 },
    zoom: { initial: 9, min: 4, max: 17 },
    interactables,
    labels,
    arrival(from) {
      const b = buildings.find((x) => x.shop.id === from) ?? buildings[1]
      const door = socketWorld(b.model, "door").setZ(FRONT_Z + 0.9)
      return { pos: door, face: door.clone().setZ(door.z + 2) }
    },
    groundAt,
    update(dt) {
      walkers.forEach((p) => {
        p.update(dt)
        p.root.position.y = groundAt(p.root.position.x, p.root.position.z)
      })
      for (const m of models) m.update(dt)
    },
    setDayProgress(t) { atmosphere.setDayProgress(t) },
    moods: () => [],
    work: () => null,
    dispose() {
      walkers.forEach((p) => p.dispose())
      models.forEach((m) => m.dispose())
      atmosphere.dispose()
      trunkGeo.dispose(); crownGeo.dispose(); trunkMat.dispose()
      leafMats.forEach((m: Material) => m.dispose())
    },
  }
}

export const SHOP_INFO = Object.fromEntries(SHOPS.map((s) => [s.id, s])) as Record<Shopfront["id"], Shopfront>
