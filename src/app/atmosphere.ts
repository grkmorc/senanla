/**
 * Lighting that follows the shop day: cool morning sun turning into a low orange
 * evening, while the interior pendants take over. Also owns the vignette backdrop.
 */
import {
  Color, HemisphereLight, DirectionalLight, CanvasTexture, SRGBColorSpace, MathUtils,
  type Scene, type PointLight,
} from "three"

const MORNING = new Color("#fff3e0")
const NOON = new Color("#fffaf0")
const EVENING = new Color("#ff9d5c")
const SKY_DAY = new Color("#fff4e6")
const SKY_EVE = new Color("#ffd2b0")

export class Atmosphere {
  readonly sun: DirectionalLight
  readonly hemi: HemisphereLight
  private readonly backdrop: CanvasTexture
  private readonly tmp = new Color()

  constructor(scene: Scene, private readonly interior: PointLight[]) {
    this.hemi = new HemisphereLight(SKY_DAY, "#3a3530", 0.9)
    scene.add(this.hemi)

    this.sun = new DirectionalLight(MORNING, 2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 })
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.sun.shadow.radius = 3
    scene.add(this.sun)
    scene.add(this.sun.target)

    this.backdrop = makeBackdrop()
    scene.background = this.backdrop
    this.setDayProgress(0)
  }

  /** t = 0 at opening (08:00), 1 at closing (20:00). */
  setDayProgress(t: number) {
    const noonish = 1 - Math.abs(t - 0.4) / 0.6
    if (t < 0.4) this.tmp.copy(MORNING).lerp(NOON, t / 0.4)
    else this.tmp.copy(NOON).lerp(EVENING, MathUtils.smoothstep(t, 0.55, 1))
    this.sun.color.copy(this.tmp)
    this.sun.intensity = MathUtils.lerp(1.1, 2.3, MathUtils.clamp(noonish, 0, 1))
    // Sun sweeps from the front-left in the morning to low side light in the evening.
    const a = MathUtils.lerp(-0.35, 0.9, t)
    const h = MathUtils.lerp(12, 6.5, MathUtils.smoothstep(t, 0.5, 1))
    this.sun.position.set(Math.sin(a) * -10, h, Math.cos(a) * 9)
    this.hemi.color.copy(SKY_DAY).lerp(SKY_EVE, MathUtils.smoothstep(t, 0.6, 1))
    this.hemi.intensity = MathUtils.lerp(0.95, 0.6, MathUtils.smoothstep(t, 0.55, 1))
    const lampLevel = MathUtils.lerp(2.4, 6, MathUtils.smoothstep(t, 0.45, 0.95))
    for (const l of this.interior) l.intensity = lampLevel
  }

  dispose() {
    this.backdrop.dispose()
  }
}

function makeBackdrop() {
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 512
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(256, 210, 40, 256, 256, 380)
  grad.addColorStop(0, "#2d2a2a")
  grad.addColorStop(0.55, "#1d1c1f")
  grad.addColorStop(1, "#111114")
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}
