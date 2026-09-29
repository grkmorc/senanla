/**
 * @shop-kit material source. Semantic slots, reference-counted cache.
 * Resolution: per-instance override -> kit override -> kit default.
 */
import { Material, MeshStandardMaterial, Color } from "three"

export type ShopSlot =
  | "surface.floor"
  | "surface.floorTrim"
  | "surface.wood"
  | "surface.woodDark"
  | "hardware.steel"
  | "hardware.steelDark"
  | "surface.paint"
  | "surface.rubber"
  | "surface.counterTop"
  | "signal.amber"
  | "signal.cyan"
  | "prop.crate"
  | "prop.goodsA"
  | "prop.goodsB"
  | "prop.goodsC"
  | "surface.floorAlt"
  | "surface.floorLight"
  | "surface.mat"
  | "surface.wainscot"
  | "surface.clockFace"
  | "surface.shade"
  | "signal.warm"
  | "surface.brick"
  | "surface.plaster"
  | "surface.corrugated"
  | "surface.roof"
  | "surface.glass"
  | "surface.asphalt"
  | "surface.sidewalk"
  | "surface.paving"
  | "surface.grass"
  | "surface.dirt"
  | "surface.curb"
  | "surface.rust"
  | "signal.paint"
  | "surface.awningLight"
  | "signal.red"
  | "signal.green"
  | "surface.carGlass"
  | "prop.simit"
  | "surface.fridgeGlass"
  | "prop.bottle"
  | "surface.fridgeLight"

interface SlotSpec { color: string; roughness: number; metalness: number; emissive?: string; emissiveIntensity?: number; opacity?: number }

const DEFAULTS: Record<ShopSlot, SlotSpec> = {
  "surface.floor":      { color: "#6b5b4b", roughness: 0.85, metalness: 0.0 },
  "surface.floorTrim":  { color: "#3d342c", roughness: 0.8,  metalness: 0.0 },
  "surface.wood":       { color: "#a0703f", roughness: 0.7,  metalness: 0.0 },
  "surface.woodDark":   { color: "#5c3b22", roughness: 0.75, metalness: 0.0 },
  "hardware.steel":     { color: "#8d949b", roughness: 0.38, metalness: 0.85 },
  "hardware.steelDark": { color: "#3a3f45", roughness: 0.5,  metalness: 0.7 },
  "surface.paint":      { color: "#2f6f6a", roughness: 0.55, metalness: 0.1 },
  "surface.rubber":     { color: "#1e1f22", roughness: 0.95, metalness: 0.0 },
  "surface.counterTop": { color: "#d9d2c3", roughness: 0.35, metalness: 0.0 },
  "signal.amber":       { color: "#ffb347", roughness: 0.4,  metalness: 0.0, emissive: "#ff9a1f", emissiveIntensity: 1.2 },
  "signal.cyan":        { color: "#5fe3ff", roughness: 0.4,  metalness: 0.0, emissive: "#2fc8ff", emissiveIntensity: 1.0 },
  "prop.crate":         { color: "#b98b52", roughness: 0.8,  metalness: 0.0 },
  "prop.goodsA":        { color: "#c8553d", roughness: 0.6,  metalness: 0.0 },
  "prop.goodsB":        { color: "#e3b23c", roughness: 0.6,  metalness: 0.0 },
  "prop.goodsC":        { color: "#4f7cac", roughness: 0.6,  metalness: 0.0 },
  "surface.floorAlt":   { color: "#58473a", roughness: 0.8,  metalness: 0.0 },
  "surface.floorLight": { color: "#7d6a55", roughness: 0.82, metalness: 0.0 },
  "surface.mat":        { color: "#6b2e2a", roughness: 0.98, metalness: 0.0 },
  "surface.wainscot":   { color: "#35625c", roughness: 0.6,  metalness: 0.05 },
  "surface.clockFace":  { color: "#efe8d8", roughness: 0.45, metalness: 0.0 },
  "surface.shade":      { color: "#1f3f3b", roughness: 0.45, metalness: 0.35 },
  "signal.warm":        { color: "#fff0d0", roughness: 0.3,  metalness: 0.0, emissive: "#ffd79a", emissiveIntensity: 2.4 },
  "surface.brick":      { color: "#8f4d3a", roughness: 0.9,  metalness: 0.0 },
  "surface.plaster":    { color: "#d8cdb8", roughness: 0.92, metalness: 0.0 },
  "surface.corrugated": { color: "#7f8a8c", roughness: 0.55, metalness: 0.6 },
  "surface.roof":       { color: "#3b3d42", roughness: 0.95, metalness: 0.0 },
  "surface.glass":      { color: "#2c3d4a", roughness: 0.12, metalness: 0.5, emissive: "#ffc98a", emissiveIntensity: 0.0 },
  "surface.asphalt":    { color: "#34363b", roughness: 0.95, metalness: 0.0 },
  "surface.sidewalk":   { color: "#9d978c", roughness: 0.9,  metalness: 0.0 },
  "surface.paving":     { color: "#a08a72", roughness: 0.9,  metalness: 0.0 },
  "surface.grass":      { color: "#5d7a45", roughness: 1.0,  metalness: 0.0 },
  "surface.dirt":       { color: "#6e5a44", roughness: 1.0,  metalness: 0.0 },
  "surface.curb":       { color: "#b8b2a6", roughness: 0.85, metalness: 0.0 },
  "surface.rust":       { color: "#8a4b2a", roughness: 0.85, metalness: 0.3 },
  "signal.paint":       { color: "#e9e4d6", roughness: 0.7,  metalness: 0.0 },
  "surface.awningLight":{ color: "#efe6d2", roughness: 0.85, metalness: 0.0 },
  "signal.red":         { color: "#ff5a4a", roughness: 0.35, metalness: 0.0, emissive: "#ff2a1a", emissiveIntensity: 2.2 },
  "surface.fridgeGlass":{ color: "#cfe6f2", roughness: 0.05, metalness: 0.1, opacity: 0.22 },
  "prop.simit":         { color: "#b8743a", roughness: 0.75, metalness: 0.0 },
  "prop.bottle":        { color: "#8fc8e8", roughness: 0.15, metalness: 0.1 },
  "surface.fridgeLight":{ color: "#eef6fb", roughness: 0.4,  metalness: 0.0, emissive: "#dff0ff", emissiveIntensity: 0.55 },
  "surface.carGlass":   { color: "#1d2a33", roughness: 0.08, metalness: 0.7 },
  "signal.green":       { color: "#6dff9a", roughness: 0.35, metalness: 0.0, emissive: "#22e070", emissiveIntensity: 2.0 },
}

export interface ShopMaterialSource {
  acquire(slot: ShopSlot): Material
  release(slot: ShopSlot, material: Material): void
  setKitOverride(slot: ShopSlot, material: Material | null): void
  readonly slots: readonly ShopSlot[]
  dispose(): void
}

export function createShopMaterialSource(): ShopMaterialSource {
  const cache = new Map<ShopSlot, { material: Material; refs: number }>()
  const kitOverrides = new Map<ShopSlot, Material>() // borrowed, never disposed

  const build = (slot: ShopSlot) => {
    const s = DEFAULTS[slot]
    const m = new MeshStandardMaterial({
      color: new Color(s.color),
      roughness: s.roughness,
      metalness: s.metalness,
      emissive: new Color(s.emissive ?? "#000000"),
      emissiveIntensity: s.emissiveIntensity ?? 0,
      transparent: s.opacity !== undefined,
      opacity: s.opacity ?? 1,
      depthWrite: s.opacity === undefined,
    })
    m.name = `shop-kit/${slot}`
    return m
  }

  return {
    slots: Object.keys(DEFAULTS) as ShopSlot[],
    acquire(slot) {
      const o = kitOverrides.get(slot)
      if (o) return o
      let entry = cache.get(slot)
      if (!entry) cache.set(slot, (entry = { material: build(slot), refs: 0 }))
      entry.refs++
      return entry.material
    },
    release(slot, material) {
      const entry = cache.get(slot)
      // Only cached kit materials are ref-counted; overrides are borrowed.
      if (!entry || entry.material !== material) return
      if (--entry.refs <= 0) {
        entry.material.dispose()
        cache.delete(slot)
      }
    },
    setKitOverride(slot, material) {
      if (material) kitOverrides.set(slot, material)
      else kitOverrides.delete(slot)
    },
    dispose() {
      cache.forEach((e) => e.material.dispose())
      cache.clear()
    },
  }
}
