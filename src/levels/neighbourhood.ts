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
import { SignFace, type SignStyle } from "@/app/signage"
import { DEVELOPMENTS, stageOf, openedCount, buildProgress, type DevId, type DevStage } from "@/game/neighbourhood"
import type { Economy } from "@/game/economy"
import { PitchGame } from "@/sim/pitch-game"
import type { Rect } from "@/sim/pedestrians"
import { NEIGHBOUR_SIGNS, TO_LET, siteSign } from "./shop-signs"

type AnyModel = ModelInstance<any, any, any>
type Place = <M extends AnyModel>(m: M, x: number, z: number, rotY?: number) => M

/** Paint a sign face onto a shop-building's board. */
export function mountBuildingSign(model: ShopBuilding): SignFace {
  const c = model.getConfig()
  const signW = Math.min(c.width - 1.2, 5.2)
  // The socket sits 20 mm in front of the board face; the sign goes 5 mm proud of it.
  return new SignFace(signW - 0.1, 0.6).mount(model.sockets.sign.anchor, -0.015)
}

export interface GrowthDeps {
  kit: ShopKit
  scene: Scene
  place: Place
  eco: Economy
  rng: () => number
  plantTree: (x: number, y: number, z: number, scale: number) => void
  /** Street geometry: south sidewalk edge, the N-S road's west sidewalk edge. */
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
    blockers.push([PITCH.x - 9, PITCH.z - 5.5, PITCH.x + 9, PITCH.z + 5.5])
  }

  // Kırtasiye: the empty shop on the north-east corner gets a tenant.
  const building = (cfg: Partial<ShopBuildingConfig>, x: number, z: number, rotY: number) => place(createShopBuilding(kit, cfg), x, z, rotY)
  const northFront = -0.1
  {
    const b = building({ width: 7.5, depth: 7, facade: "plaster", awning: "teal", upperFloors: 1 }, 52, northFront - 3.5, 0)
    const face = mountBuildingSign(b)
    signs.push(face)
    // A shop fit-out needs no building site: the sign just changes.
    lots.push({
      id: "stationery", site: null, open: [], planned: [], growsFloors: false,
      onStage: (st) => face.set(st === "open" ? NEIGHBOUR_SIGNS.kirtasiye
        : st === "building" ? { ...NEIGHBOUR_SIGNS.kirtasiye, sub: "Yarın açılıyor", unlit: true } : TO_LET),
    })
  }

  // Apartment block with a florist, across the road where the lot stood empty.
  {
    const x = -30
    const depth = 8
    const z = d.southEdge + 0.1 + depth / 2
    const b = building({ width: 9, depth, facade: "plaster", awning: "red", upperFloors: 3 }, x, z, Math.PI)
    const face = mountBuildingSign(b)
    face.set(NEIGHBOUR_SIGNS.cicekci)
    signs.push(face)
    const { site } = makeSite("apartment", x, z, Math.PI, 9, depth, true)
    lots.push({ id: "apartment", site, open: [b.root], planned: [], growsFloors: true })
    reserved.push([x - 5, z - 4.5, x + 5, z + 4.5])
  }

  // Corner café facing the N-S road, behind the supermarket.
  {
    const depth = 7
    const x = d.roadWestEdge - 0.1 - depth / 2
    const z = -15.5
    const b = building({ width: 7.5, depth, facade: "brick", awning: "amber", upperFloors: 1 }, x, z, Math.PI / 2)
    const face = mountBuildingSign(b)
    face.set(NEIGHBOUR_SIGNS.kafe)
    signs.push(face)
    const { site } = makeSite("cafe", x, z, Math.PI / 2, 7.5, depth, true)
    lots.push({ id: "cafe", site, open: [b.root], planned: [], growsFloors: true })
    reserved.push([x - 4.5, z - 4.5, x + 4.5, z + 4.5])
    blockers.push([x - 3.5, z - 3.75, x + 3.5, z + 3.75])
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

  const population = () => 22 + openedCount(d.eco.day) * 3

  return {
    blockers,
    walkways,
    reserved,
    lamps,
    signs,
    population,
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
      lamps.forEach((l) => l.actions.setOn(on))
      pitch.actions.setLights(on)
      pitchLight.intensity = pitch.root.visible ? k * 40 : 0
    },
    dispose() {
      game.dispose()
      signs.forEach((s) => s.dispose())
    },
  }
}

export type Neighbourhood = ReturnType<typeof buildNeighbourhood>
export type { SignStyle }
