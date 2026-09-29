/**
 * Shared interior shell: floor + walls, doormat exit, pendant lamps, optional wall clock
 * and day-driven lighting. Each shop level adds its own furniture and game on top.
 */
import { PointLight, Scene, Vector3, type Material } from "three"
import type { ShopKit } from "@/kits/shop-kit/context"
import type { ModelInstance } from "@/lib/vibe3d/model"
import { createShopFloor, WALL_T, type ShopFloor, type ShopFloorConfig } from "@/models/shop-kit/shop-floor"
import { createPendantLamp } from "@/models/shop-kit/pendant-lamp"
import { createWallClock, type WallClock } from "@/models/shop-kit/wall-clock"
import { Atmosphere } from "@/app/atmosphere"
import { type Interactable, type LevelId, worldPos } from "./level"

type AnyModel = ModelInstance<any, any, any>

export interface InteriorOptions {
  kit: ShopKit
  floor: Partial<ShopFloorConfig> & { width: number; depth: number }
  floorMaterials?: Partial<Record<string, Material>>
  pendants: [number, number][]
  clockX?: number
  go(to: LevelId): void
}

export interface Interior {
  scene: Scene
  floor: ShopFloor
  hw: number
  hd: number
  /** Z of a shelf standing against the back wall with the given depth. */
  backZ(depth: number): number
  place<M extends AnyModel>(m: M, x: number, z: number, rotY?: number): M
  models: AnyModel[]
  entrance: Vector3
  exit: Interactable
  clock: WallClock | null
  atmosphere: Atmosphere
  arrival(): { pos: Vector3; face: Vector3 }
  setClock(hours: number): void
  dispose(): void
}

export function buildInterior(o: InteriorOptions): Interior {
  const scene = new Scene()
  const floor = createShopFloor(o.kit, o.floor, o.floorMaterials)
  scene.add(floor.root)
  const models: AnyModel[] = [floor]
  const place = <M extends AnyModel>(m: M, x: number, z: number, rotY = 0): M => {
    m.root.position.set(x, 0, z)
    m.root.rotation.y = rotY
    scene.add(m.root)
    m.root.updateMatrixWorld(true)
    models.push(m)
    return m
  }
  const hw = o.floor.width / 2
  const hd = o.floor.depth / 2

  const pendants = o.pendants.map(([x, z]) => place(createPendantLamp(o.kit, { ceiling: 2.95, drop: 0.62 }), x, z))
  const lights = pendants.map((p) => {
    p.root.traverse((n) => { n.castShadow = false })
    const l = new PointLight("#ffcf8a", 2, 5, 1.4)
    l.userData.vibe3dRole = "pendant.light"
    l.userData.excludeFromExport = true
    l.position.copy(p.sockets.light.anchor.position)
    p.parts.bulb.anchor.add(l)
    return l
  })

  let clock: WallClock | null = null
  if (o.clockX !== undefined) {
    clock = place(createWallClock(o.kit, { radius: 0.24 }), o.clockX, -hd + WALL_T)
    clock.root.position.y = 1.95
  }

  const atmosphere = new Atmosphere(scene, lights)
  const entrance = worldPos(floor.sockets.entrance.anchor)

  const exit: Interactable = {
    id: "exit",
    label: "Dışarı çık",
    pick: floor.parts.mat.anchor,
    spot: () => entrance.clone().setZ(hd - 0.35),
    face: () => entrance.clone().setZ(hd + 2),
    interact: () => o.go("outdoor"),
  }

  return {
    scene,
    floor,
    hw,
    hd,
    backZ: (depth) => -hd + WALL_T + depth / 2 + 0.02,
    place,
    models,
    entrance,
    exit,
    clock,
    atmosphere,
    arrival: () => ({ pos: entrance.clone(), face: new Vector3(entrance.x, 0, 0) }),
    setClock(hours) { clock?.actions.setTime(Math.floor(hours), (hours % 1) * 60) },
    dispose() {
      models.forEach((m) => m.dispose())
      atmosphere.dispose()
    },
  }
}

export const socketWorld = (m: AnyModel, name: string) => worldPos(m.sockets[name].anchor)
