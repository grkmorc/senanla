/**
 * Coplanar check (vibe-model rule 9): fails when two different meshes have
 * visible faces on the same plane facing the same way with overlapping area.
 * Usage: node --import tsx scripts/coplanar-check.ts [model-id ...]
 */
import { Mesh, Vector3, Object3D } from "three"
import { createShopKit } from "@/kits/shop-kit/context"
import { createModel as floor } from "@/models/shop-kit/shop-floor"
import { createModel as shelf } from "@/models/shop-kit/modular-shelf"
import { createModel as bench } from "@/models/shop-kit/repair-bench"
import { createModel as counter } from "@/models/shop-kit/checkout-counter"
import { createModel as pendant } from "@/models/shop-kit/pendant-lamp"
import { createModel as clock } from "@/models/shop-kit/wall-clock"
import { createModel as building } from "@/models/shop-kit/shop-building"
import { createModel as street } from "@/models/shop-kit/street-block"
import { createModel as streetLamp } from "@/models/shop-kit/street-lamp"
import { createModel as scrap } from "@/models/shop-kit/scrap-pile"
import { createModel as car } from "@/models/shop-kit/car"
import { createModel as tlight } from "@/models/shop-kit/traffic-light"
import { createModel as cart } from "@/models/shop-kit/street-cart"
import { createModel as fridge } from "@/models/shop-kit/drinks-fridge"
import { createModel as plaza } from "@/models/shop-kit/plaza"
import { createModel as fountain } from "@/models/shop-kit/fountain"
import { createModel as parkBench } from "@/models/shop-kit/park-bench"
import { createModel as planter } from "@/models/shop-kit/planter"
import { createModel as pitch } from "@/models/shop-kit/football-pitch"
import { createModel as playground } from "@/models/shop-kit/playground"
import { createModel as barberPole } from "@/models/shop-kit/barber-pole"
import { createModel as site } from "@/models/shop-kit/construction-site"
import { createModel as roofSign } from "@/models/shop-kit/rooftop-sign"

const factories: Record<string, (k: ReturnType<typeof createShopKit>) => { root: Object3D; dispose(): void }> = {
  "shop-floor": (k) => floor(k, { width: 6, depth: 5 }),
  "modular-shelf": (k) => shelf(k),
  "repair-bench": (k) => bench(k),
  "checkout-counter": (k) => counter(k),
  "pendant-lamp": (k) => pendant(k),
  "wall-clock": (k) => clock(k),
  "shop-building": (k) => building(k),
  "shop-building-metal": (k) => building(k, { facade: "metal", shutter: true, awning: "amber" }),
  "street-block": (k) => street(k, { width: 20, depth: 16 }),
  "street-lamp": (k) => streetLamp(k),
  "scrap-pile": (k) => scrap(k, { variant: 3 }),
  "street-block-cross": (k) => street(k, { width: 40, depth: 30, cross: true, crossX: 8, crossingX: -10 }),
  "shop-building-apartment": (k) => building(k, { upperFloors: 2, awning: "none", facade: "brick" }),
  "car-sedan": (k) => car(k),
  "car-van": (k) => car(k, { style: "van", paint: "white" }),
  "car-hatch": (k) => car(k, { style: "hatch", paint: "blue" }),
  "car-taxi": (k) => car(k, { style: "taxi" }),
  "traffic-light": (k) => tlight(k),
  "street-cart": (k) => cart(k),
  "street-cart-full": (k) => cart(k, { umbrella: true, tray: 3 }),
  "drinks-fridge": (k) => fridge(k),
  "plaza": (k) => plaza(k, { width: 6, depth: 5 }),
  "fountain": (k) => fountain(k),
  "park-bench": (k) => parkBench(k),
  "planter": (k) => planter(k),
  "drinks-fridge-wide": (k) => fridge(k, { width: 1.6, stock: 0.6, brand: "blue" }),
  "football-pitch": (k) => pitch(k),
  "football-pitch-bare": (k) => pitch(k, { width: 14, depth: 9, fence: false, floodlights: false }),
  "playground": (k) => playground(k),
  "playground-3": (k) => playground(k, { width: 10, swings: 3 }),
  "barber-pole": (k) => barberPole(k),
  "construction-site": (k) => site(k),
  "rooftop-sign": (k) => roofSign(k),
  "rooftop-sign-wide": (k) => roofSign(k, { width: 9, height: 1.8, lift: 0.8 }),
  "construction-site-slab": (k) => site(k, { width: 10, depth: 9, floors: 0, crane: false }),
}

type Tri = { a: Vector3; b: Vector3; c: Vector3; mesh: string }
const Q = 1e-4

function collect(root: Object3D) {
  root.updateMatrixWorld(true)
  const buckets = new Map<string, Tri[]>()
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || !m.visible) return
    const pos = m.geometry.getAttribute("position")
    const index = m.geometry.getIndex()
    const n = index ? index.count : pos.count
    for (let i = 0; i < n; i += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k))
      const [a, b, c] = ids.map((id) => new Vector3().fromBufferAttribute(pos, id).applyMatrix4(m.matrixWorld))
      const nrm = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a))
      const area = nrm.length() / 2
      if (area < 1e-6) continue
      nrm.normalize()
      const d = nrm.dot(a)
      const key = [nrm.x, nrm.y, nrm.z, d].map((v) => Math.round(v / Q) * Q + 0).map((v) => v.toFixed(4)).join(",")
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push({ a, b, c, mesh: m.name })
    }
  })
  return buckets
}

function project(t: Tri, axis: number): [number, number][] {
  const drop = (v: Vector3): [number, number] => (axis === 0 ? [v.y, v.z] : axis === 1 ? [v.x, v.z] : [v.x, v.y])
  return [drop(t.a), drop(t.b), drop(t.c)]
}

/** Strict 2D triangle overlap by SAT with an inward tolerance. */
function overlap2d(p: [number, number][], q: [number, number][]) {
  const eps = 5e-4
  for (const poly of [p, q]) {
    for (let i = 0; i < 3; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % 3]
      const nx = y0 - y1, ny = x1 - x0
      const len = Math.hypot(nx, ny)
      const proj = (s: [number, number][]) => s.map(([x, y]) => (x * nx + y * ny) / len)
      const a = proj(p), b = proj(q)
      if (Math.max(...a) - eps <= Math.min(...b) || Math.max(...b) - eps <= Math.min(...a)) return false
    }
  }
  return true
}

let failed = 0
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(factories)
for (const id of ids) {
  const kit = createShopKit()
  const model = factories[id](kit)
  const buckets = collect(model.root)
  const hits = new Set<string>()
  for (const [key, tris] of buckets) {
    const [nx, ny, nz] = key.split(",").map(Number)
    const axis = [Math.abs(nx), Math.abs(ny), Math.abs(nz)].indexOf(Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz)))
    for (let i = 0; i < tris.length; i++) for (let j = i + 1; j < tris.length; j++) {
      if (tris[i].mesh === tris[j].mesh) continue
      if (overlap2d(project(tris[i], axis), project(tris[j], axis))) hits.add(`${tris[i].mesh} <-> ${tris[j].mesh}`)
    }
  }
  if (hits.size) {
    failed++
    console.log(`✗ ${id}: ${hits.size} coplanar pair(s)`)
    ;[...hits].slice(0, 12).forEach((h) => console.log("   ", h))
  } else console.log(`✓ ${id}`)
  model.dispose()
  kit.dispose()
}
process.exit(failed ? 1 : 0)
