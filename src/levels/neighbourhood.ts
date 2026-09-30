/**
 * The growing part of the street: the park across the road, and the developments from
 * `@/game/neighbourhood` (playground, halı saha, new shops and buildings) that go from
 * empty lot → building site → open as the days pass.
 */
import { PointLight, Vector3, type Object3D, type Scene } from "three"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { ModelInstance } from "@/lib/vibe3d/model"
import { createShopBuilding, type ShopBuilding, type ShopBuildingConfig } from "@/models/shop-kit/shop-building"
import { createConstructionSite, type ConstructionSite } from "@/models/shop-kit/construction-site"
import { createFootballPitch } from "@/models/shop-kit/football-pitch"
import { createPlayground } from "@/models/shop-kit/playground"
import { createPlaza, PLAZA_TOP } from "@/models/shop-kit/plaza"
import { createParkBench } from "@/models/shop-kit/park-bench"
import { createPlanter } from "@/models/shop-kit/planter"
import { createStreetLamp } from "@/models/shop-kit/street-lamp"
import { createRooftopSign, type RooftopSign } from "@/models/shop-kit/rooftop-sign"
import { SignFace, type SignStyle } from "@/app/signage"
import { DEVELOPMENTS, stageOf, openedCount, buildProgress, type DevId, type DevStage } from "@/game/neighbourhood"
import type { Economy } from "@/game/economy"
import { PitchGame } from "@/sim/pitch-game"
import type { Rect } from "@/sim/pedestrians"
import { NEIGHBOUR_SIGNS, neighbourLed, siteSign, type NeighbourShop } from "./shop-signs"

type AnyModel = ModelInstance<any, any, any>
type Place = <M extends AnyModel>(m: M, x: number, z: number, rotY?: number) => M

/** Paint a sign face onto a shop-building's board. */
export function mountBuildingSign(model: ShopBuilding): SignFace {
  const c = model.getConfig()
  const signW = Math.min(c.width - 1.2, 5.2)
  // The socket sits 20 mm in front of the board face; the sign goes 5 mm proud of it.
  return new SignFace(signW - 0.1, 0.6).mount(model.sockets.sign.anchor, -0.015)
}

/** A big LED box on a building's roof, lettered on both faces so it reads from either side. */
export class RoofSign {
  readonly faces: SignFace[]
  constructor(readonly model: RooftopSign) {
    const c = model.getConfig()
    const front = new SignFace(c.width - 0.04, c.height - 0.04).mount(model.sockets.front.anchor, 0.004)
    const back = new SignFace(c.width - 0.04, c.height - 0.04).mount(model.sockets.back.anchor)
    back.mesh.rotation.y = Math.PI
    back.mesh.position.z = -0.004
    this.faces = [front, back]
  }
  /** `null` takes the whole sign down. */
  set(style: SignStyle | null) {
    this.model.root.visible = style !== null
    if (style) this.faces.forEach((f) => f.set(style))
  }
  setGlow(k: number) { this.faces.forEach((f) => f.setGlow(k)) }
  refresh() { this.faces.forEach((f) => f.refresh()) }
  dispose() { this.faces.forEach((f) => f.dispose()) }
}

/** Stand a rooftop LED sign behind the parapet of a shop-building. */
export function mountRoofSign(kit: ShopKit, place: Place, building: ShopBuilding): RoofSign {
  const c = building.getConfig()
  const width = Math.min(c.width - 0.9, 7.5)
  const top = c.height + c.upperFloors * 3 + 0.03
  const m = place(createRooftopSign(kit, { width, height: width > 5.5 ? 1.6 : 1.3, lift: 0.5 }), 0, 0)
  building.root.updateMatrixWorld(true)
  const at = building.root.localToWorld(new Vector3(0, top, c.depth / 2 - 0.75))
  m.root.position.copy(at)
  m.root.rotation.y = building.root.rotation.y
  m.root.updateMatrixWorld(true)
  return new RoofSign(m)
}

export interface GrowthDeps {
  kit: ShopKit
  scene: Scene
  place: Place
  eco: Economy
  rng: () => number
  plantTree: (x: number, y: number, z: number, scale: number) => void
  /** Street geometry: building lines, south sidewalk edge, the N-S road's west sidewalk edge. */
  northFront: number
  southFront: number
  southEdge: number
  roadWestEdge: number
  news: (title: string, body: string) => void
  say: (msg: string) => void
  popup: (at: Vector3, text: string) => void
}

interface Lot {
  id: DevId
  /** Shown while under construction (none for a plain shop fit-out). */
  site: ConstructionSite | null
  /** Shown once open (may be null when the "open" state is handled elsewhere). */
  open: Object3D[]
  /** Hidden once open. */
  planned: Object3D[]
  growsFloors: boolean
  onStage?: (s: DevStage) => void
}

export function buildNeighbourhood(d: GrowthDeps) {
  const { kit, place } = d
  const signs: SignFace[] = []
  const roofSigns: RoofSign[] = []
  const locations = new Map<DevId, Vector3>()
  const lamps: ReturnType<typeof createStreetLamp>[] = []
  const blockers: Rect[] = []
  const reserved: Rect[] = []
  const walkways: Rect[] = []

  // ---------------------------------------------------------------- the park
  const PARK = new Vector3(-6, 0, 22)
  const S = d.southEdge
  place(createPlaza(kit, { width: 7, depth: 7, ring: 2.4 }), PARK.x, PARK.z)
  place(createPlaza(kit, { width: 2.4, depth: PARK.z - 3.5 - S - 0.05, ring: 0, slab: 0.6 }), PARK.x, (S + 0.05 + PARK.z - 3.5) / 2)
  const planter = place(createPlanter(kit, { size: 1.6, height: 0.5 }), PARK.x, PARK.z)
  planter.root.position.y = PLAZA_TOP
  planter.root.updateMatrixWorld(true)
  const at = planter.sockets.plant.anchor.getWorldPosition(new Vector3())
  d.plantTree(at.x, at.y - 0.3, at.z, 1.1)
  const benchSpots: [number, number, number][] = [
    [PARK.x, PARK.z + 2.85, Math.PI], [PARK.x - 2.85, PARK.z, Math.PI / 2], [PARK.x + 2.85, PARK.z, -Math.PI / 2],
  ]
  for (const [x, z, r] of benchSpots) place(createParkBench(kit), x, z, r).root.position.y = PLAZA_TOP
  for (const [x, z] of [[PARK.x - 3.1, PARK.z - 3.1], [PARK.x + 3.1, PARK.z + 3.1]]) lamps.push(place(createStreetLamp(kit), x, z))
  reserved.push([PARK.x - 4, S, PARK.x + 4, PARK.z + 4])
  blockers.push([PARK.x - 0.9, PARK.z - 0.9, PARK.x + 0.9, PARK.z + 0.9])
  walkways.push([-14.5, S + 1, 2.5, 33])

  // ---------------------------------------------------------------- developments
  const lots: Lot[] = []
  const devById = (id: DevId) => DEVELOPMENTS.find((x) => x.id === id)!
  const makeSite = (id: DevId, x: number, z: number, rotY: number, width: number, depth: number, crane: boolean) => {
    const site = place(createConstructionSite(kit, { width, depth, floors: 0, crane }), x, z, rotY)
    const dev = devById(id)
    const sign = new SignFace(2.1, 0.62).mount(site.sockets.sign.anchor, -0.008)
    sign.set(siteSign(dev.name, dev.day))
    signs.push(sign)
    return { site, sign }
  }

  // Playground, north-west corner of the park.
  {
    const x = -11.8
    const z = 28.6
    const pg = place(createPlayground(kit, { width: 7, depth: 5.5 }), x, z)
    const { site } = makeSite("playground", x, z, 0, 7, 5.5, false)
    lots.push({ id: "playground", site, open: [pg.root], planned: [], growsFloors: false })
    locations.set("playground", new Vector3(x, 0, z))
    reserved.push([x - 3.8, z - 3.1, x + 3.8, z + 3.1])
    blockers.push([x - 3.5, z - 2.75, x + 3.5, z + 2.75])
  }

  // Halı saha, east of the park; the gate and the site's plate face the camera side.
  const PITCH = new Vector3(13.4, 0, 21.6)
  const pitch = place(createFootballPitch(kit, { width: 18, depth: 11 }), PITCH.x, PITCH.z)
  // One wide light over the pitch stands in for the four floodlights at night.
  const pitchLight = new PointLight("#fff1d6", 0, 24, 1.2)
  pitchLight.userData.excludeFromExport = true
  pitchLight.position.set(0, 7, 0)
  pitch.root.add(pitchLight)
  const game = new PitchGame(d.scene, PITCH, 9 - 1.1, 5.5 - 1.1, 1.5, 0.034, d.rng, (p, team) => {
    d.popup(p.setY(1.2), team === 0 ? "GOL! Kırmızılar" : "GOL! Sarılar")
  })
  {
    const { site } = makeSite("pitch", PITCH.x, PITCH.z, 0, 16, 11, false)
    lots.push({
      id: "pitch", site, open: [pitch.root], planned: [], growsFloors: false,
      onStage: (s) => game.setActive(s === "open"),
    })
    reserved.push([PITCH.x - 9.5, S, PITCH.x + 9.5, PITCH.z + 6])
    locations.set("pitch", PITCH.clone())
    blockers.push([PITCH.x - 9, PITCH.z - 5.5, PITCH.x + 9, PITCH.z + 5.5])
  }

  // Kırtasiye: the empty shop on the north-east corner gets a tenant.
  const building = (cfg: Partial<ShopBuildingConfig>, x: number, z: number, rotY: number) => place(createShopBuilding(kit, cfg), x, z, rotY)
  const northFront = d.northFront
  {
    const b = building({ width: 7.5, depth: 7, facade: "plaster", awning: "teal", upperFloors: 1 }, 52, northFront - 3.5, 0)
    const face = mountBuildingSign(b)
    signs.push(face)
    const roof = mountRoofSign(kit, place, b)
    roofSigns.push(roof)
    locations.set("stationery", new Vector3(52, 0, northFront - 3.5))
    // A shop fit-out needs no building site: the shutters are down, then the signs light up.
    lots.push({
      id: "stationery", site: null, open: [], planned: [], growsFloors: false,
      onStage: (st) => {
        face.set(st === "open" ? NEIGHBOUR_SIGNS.kirtasiye : { ...NEIGHBOUR_SIGNS.kirtasiye, sub: st === "building" ? "Yarın açılıyor" : "Yakında", unlit: true })
        roof.set(st === "open" ? neighbourLed("kirtasiye") : null)
      },
    })
  }

  // New buildings on empty lots: a building site first, then a shop with its signs.
  const LOTS: { id: DevId; shop: NeighbourShop; side: "n" | "s" | "w"; at: number; config: Partial<ShopBuildingConfig> }[] = [
    { id: "apartment", shop: "cicekci", side: "s", at: -30, config: { width: 9, depth: 8, facade: "plaster", awning: "red", upperFloors: 3 } },
    { id: "cafe", shop: "kafe", side: "w", at: -15.5, config: { width: 7.5, depth: 7, facade: "brick", awning: "amber", upperFloors: 1 } },
    { id: "bakery", shop: "pastane", side: "n", at: -56, config: { width: 9, depth: 8, facade: "plaster", awning: "red", upperFloors: 2 } },
    { id: "hotel", shop: "otel", side: "s", at: 72, config: { width: 10, depth: 9, facade: "plaster", awning: "none", upperFloors: 4 } },
    { id: "gym", shop: "spor", side: "n", at: 72, config: { width: 9, depth: 8, facade: "metal", awning: "none", shutter: true, upperFloors: 1 } },
  ]
  for (const lot of LOTS) {
    const depth = lot.config.depth ?? 7
    const width = lot.config.width ?? 8
    const [x, z, rot] = lot.side === "n" ? [lot.at, d.northFront - depth / 2, 0]
      : lot.side === "s" ? [lot.at, d.southFront + depth / 2, Math.PI]
        : [d.roadWestEdge - 0.1 - depth / 2, lot.at, Math.PI / 2]
    const b = building(lot.config, x, z, rot)
    const face = mountBuildingSign(b)
    face.set(NEIGHBOUR_SIGNS[lot.shop])
    signs.push(face)
    const roof = mountRoofSign(kit, place, b)
    roof.set(neighbourLed(lot.shop))
    roofSigns.push(roof)
    const { site } = makeSite(lot.id, x, z, rot, width, depth, true)
    lots.push({ id: lot.id, site, open: [b.root, roof.model.root], planned: [], growsFloors: true })
    locations.set(lot.id, new Vector3(x, 0, z))
    const [hx, hz] = lot.side === "w" ? [depth / 2, width / 2] : [width / 2, depth / 2]
    reserved.push([x - hx - 0.5, z - hz - 0.5, x + hx + 0.5, z + hz + 0.5])
    if (lot.side === "w") blockers.push([x - hx, z - hz, x + hx, z + hz])
  }

  // ---------------------------------------------------------------- stages
  const stages = new Map<DevId, DevStage>()
  const sync = (initial: boolean) => {
    for (const lot of lots) {
      const dev = devById(lot.id)
      const s = stageOf(dev, d.eco.day)
      const prev = stages.get(lot.id)
      if (prev === s) continue
      stages.set(lot.id, s)
      if (lot.site) lot.site.root.visible = s === "building"
      lot.open.forEach((o) => { o.visible = s === "open" })
      lot.planned.forEach((o) => { o.visible = s === "planned" })
      lot.onStage?.(s)
      if (initial) continue
      if (s === "open") d.news(dev.name, dev.news)
      else if (s === "building") d.say(`Mahallede inşaat başladı · ${dev.name}, ${dev.day}. gün açılıyor`)
    }
  }
  sync(true)

  const population = () => 34 + openedCount(d.eco.day) * 3

  return {
    blockers,
    walkways,
    reserved,
    lamps,
    signs,
    roofSigns,
    population,
    /** Where a development stands, for the camera. */
    locate: (id: DevId) => locations.get(id)?.clone() ?? null,
    stages,
    sync,
    update(dt: number) {
      game.update(dt)
      // Buildings rise through the day before they open.
      for (const lot of lots) {
        if (!lot.site || !lot.growsFloors || stages.get(lot.id) !== "building") continue
        const floors = Math.min(3, Math.floor(buildProgress(devById(lot.id), d.eco.day, d.eco.dayProgress) * 4))
        if (lot.site.getConfig().floors !== floors) lot.site.configure({ floors })
      }
    },
    setNight(k: number, on: boolean) {
      signs.forEach((s) => s.setGlow(k))
      roofSigns.forEach((s) => s.setGlow(k))
      lamps.forEach((l) => l.actions.setOn(on))
      pitch.actions.setLights(on)
      pitchLight.intensity = pitch.root.visible ? k * 40 : 0
    },
    dispose() {
      game.dispose()
      signs.forEach((s) => s.dispose())
      roofSigns.forEach((s) => s.dispose())
    },
  }
}

export type Neighbourhood = ReturnType<typeof buildNeighbourhood>
export type { SignStyle }
