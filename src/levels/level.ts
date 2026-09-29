/**
 * A level is one walkable place (the street or a shop interior) with its own scene,
 * navigation grid, clickable things and simulation. The engine renders only the active
 * level but keeps every level simulating, so shops stay busy while you're away.
 */
import { Box3, Vector3, type Object3D, type Scene } from "three"
import { NavGrid } from "@/app/nav-grid"
import type { Mood } from "@/game/crowd"

export type LevelId = "outdoor" | "sales" | "repair" | "scrap"

export interface Interactable {
  id: string
  label: string
  /** Raycast + hover-outline target. */
  pick: Object3D
  /** Where the player stands to use it (world space). */
  spot(): Vector3
  /** What the player faces on arrival. */
  face(): Vector3
  interact(): void
}

export interface WorldLabel {
  text: string
  at: Vector3
}

export interface LevelContext {
  playerMoving: boolean
  playerPos: Vector3
}

export interface Level {
  readonly id: LevelId
  readonly title: string
  /** False for the street: no player, free camera, clicks only open shops. */
  readonly walkable?: boolean
  readonly scene: Scene
  readonly nav: NavGrid
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  readonly zoom: { initial: number; min: number; max: number }
  readonly interactables: Interactable[]
  readonly labels: WorldLabel[]
  /** Where the player appears when arriving from `from`. */
  arrival(from: LevelId | null): { pos: Vector3; face: Vector3 }
  update(dt: number, ctx: LevelContext): void
  /** Camera target when arriving (non-walkable levels). */
  cameraFocus?(from: LevelId | null): Vector3
  /** Test hooks. */
  readonly debug?: Record<string, unknown>
  /** Walking surface height; defaults to 0. */
  groundAt?(x: number, z: number): number
  setDayProgress(t: number): void
  moods(): Mood[]
  /** Task progress to show in the HUD (0..1), if any work is underway here. */
  work(): { text: string; progress: number } | null
  dispose(): void
}

/** Build a nav grid with a rectangle blocked around each object's world bounds. */
export function navFor(
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  blockers: Object3D[],
  agentRadius = 0.24,
  cell = 0.2,
  extra: [number, number, number, number][] = [],
): NavGrid {
  const nav = new NavGrid(area.minX, area.minZ, area.maxX, area.maxZ, cell)
  nav.blockBorder(agentRadius)
  const box = new Box3()
  for (const o of blockers) {
    o.updateMatrixWorld(true)
    box.setFromObject(o)
    nav.blockRect(box.min.x, box.min.z, box.max.x, box.max.z, agentRadius)
  }
  for (const [x0, z0, x1, z1] of extra) nav.blockRect(x0, z0, x1, z1, agentRadius)
  return nav
}

export const worldPos = (o: Object3D) => o.getWorldPosition(new Vector3())
