/**
 * Post-processing chain: scene -> ambient occlusion -> hover outline -> bloom -> tone map.
 * "low" quality drops AO and bloom for phones and slow GPUs.
 */
import { Vector2, type WebGLRenderer, type Scene, type Camera, type Object3D } from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js"
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"

export type Quality = "high" | "low"

export class RenderPipeline {
  private readonly composer: EffectComposer
  private readonly base: RenderPass
  private readonly ao: GTAOPass
  private readonly outline: OutlinePass
  private readonly bloom: UnrealBloomPass
  quality: Quality

  constructor(private readonly renderer: WebGLRenderer, scene: Scene, camera: Camera, quality: Quality) {
    const w = renderer.domElement.clientWidth || 1
    const h = renderer.domElement.clientHeight || 1
    this.composer = new EffectComposer(renderer)
    this.base = new RenderPass(scene, camera)
    this.composer.addPass(this.base)

    this.ao = new GTAOPass(scene, camera, w, h)
    this.ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 })
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 })
    this.ao.blendIntensity = 0.85
    this.composer.addPass(this.ao)

    this.outline = new OutlinePass(new Vector2(w, h), scene, camera)
    this.outline.visibleEdgeColor.set("#ffc46b")
    this.outline.hiddenEdgeColor.set("#6b4a1e")
    this.outline.edgeStrength = 4
    this.outline.edgeThickness = 1.2
    this.outline.edgeGlow = 0.3
    this.composer.addPass(this.outline)

    this.bloom = new UnrealBloomPass(new Vector2(w, h), 0.55, 0.45, 0.9)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.quality = quality
    this.setQuality(quality)
  }

  setQuality(q: Quality) {
    this.quality = q
    this.ao.enabled = q === "high"
    this.bloom.enabled = q === "high"
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q === "high" ? 2 : 1.25))
  }

  /** Point every pass at another scene (level switch). */
  setScene(scene: Scene) {
    this.base.scene = scene
    this.ao.scene = scene
    this.outline.renderScene = scene
  }

  setHover(objects: Object3D[]) {
    this.outline.selectedObjects = objects
  }

  setSize(w: number, h: number) {
    this.renderer.setSize(w, h)
    this.composer.setPixelRatio(this.renderer.getPixelRatio())
    this.composer.setSize(w, h)
  }

  render(dt: number) {
    this.composer.render(dt)
  }

  dispose() {
    this.composer.dispose()
    this.ao.dispose()
    this.outline.dispose()
    this.bloom.dispose()
  }
}

export function defaultQuality(): Quality {
  const small = Math.min(innerWidth, innerHeight) < 600
  const coarse = matchMedia?.("(pointer: coarse)").matches
  return small || coarse ? "low" : "high"
}
