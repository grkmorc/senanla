/**
 * Painted shop signs: a canvas-textured face that sits on a model's `ui.label` sign socket
 * (the shop-building's board, the construction hoarding's plate). The model stays
 * text-free; the app owns the lettering, colours and how bright the sign glows at night.
 */
import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from "three"

export type SignIcon = "pole" | "bread" | "cross" | "knife" | "pencil" | "cup" | "needle" | "flower" | "phone" | "cart" | "pot" | "helmet" | "ball"

export interface SignStyle {
  text: string
  sub?: string
  bg: string
  fg: string
  /** Stripe along the bottom edge and the icon colour. */
  accent?: string
  icon?: SignIcon
  /** Dim, unlit sign (closed / to let). */
  unlit?: boolean
}

const PX_PER_M = 200

export class SignFace {
  readonly mesh: Mesh
  private readonly canvas = document.createElement("canvas")
  private readonly texture: CanvasTexture
  private readonly material: MeshStandardMaterial
  private key = ""
  private unlit = false
  private glow = 0

  constructor(readonly width: number, readonly height: number) {
    this.canvas.width = Math.round(width * PX_PER_M)
    this.canvas.height = Math.round(height * PX_PER_M)
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.anisotropy = 4
    this.material = new MeshStandardMaterial({ map: this.texture, emissiveMap: this.texture, emissive: "#ffffff", roughness: 0.55, metalness: 0 })
    this.mesh = new Mesh(new PlaneGeometry(width, height), this.material)
    this.mesh.userData.excludeFromExport = true
    this.mesh.receiveShadow = true
  }

  /** Mount on a socket anchor, `lift` metres in front of it along its local +Z. */
  mount(anchor: Object3D, lift = 0) {
    this.mesh.position.set(0, 0, lift)
    anchor.add(this.mesh)
    return this
  }

  set(style: SignStyle) {
    const key = JSON.stringify(style)
    if (key === this.key) return
    this.key = key
    this.unlit = !!style.unlit
    draw(this.canvas, style)
    this.texture.needsUpdate = true
    this.setGlow(this.glow)
  }

  /** Repaint with the current style (e.g. once the web font has loaded). */
  refresh() {
    if (!this.key) return
    const style = JSON.parse(this.key) as SignStyle
    this.key = ""
    this.set(style)
  }

  /** 0 = daylight, 1 = full night glow. */
  setGlow(k: number) {
    this.glow = k
    this.material.emissiveIntensity = this.unlit ? 0.05 : 0.18 + k * 0.75
  }

  dispose() {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
  }
}

const FONT = `"Bricolage Grotesque", "Arial Black", Arial, sans-serif`

function draw(cv: HTMLCanvasElement, s: SignStyle) {
  const g = cv.getContext("2d")!
  const W = cv.width
  const H = cv.height
  g.fillStyle = s.bg
  g.fillRect(0, 0, W, H)
  // Inner pinstripe border.
  g.strokeStyle = s.fg
  g.globalAlpha = 0.35
  g.lineWidth = Math.max(2, H * 0.03)
  g.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12)
  g.globalAlpha = 1
  if (s.accent) {
    g.fillStyle = s.accent
    g.fillRect(0, H * 0.9, W, H * 0.1)
  }
  let left = H * 0.14
  if (s.icon) {
    const r = H * 0.3
    drawIcon(g, s.icon, H * 0.14 + r, H * 0.47, r, s.accent ?? s.fg, s.bg)
    left = H * 0.14 + r * 2 + H * 0.12
  }
  const right = W - H * 0.14
  const avail = right - left
  const cx = left + avail / 2
  g.fillStyle = s.fg
  g.textAlign = "center"
  g.textBaseline = "middle"
  const main = s.text.toLocaleUpperCase("tr")
  let size = H * (s.sub ? 0.46 : 0.58)
  g.font = `800 ${size}px ${FONT}`
  const w = g.measureText(main).width
  if (w > avail) { size *= avail / w; g.font = `800 ${size}px ${FONT}` }
  g.fillText(main, cx, s.sub ? H * 0.4 : H * 0.5)
  if (s.sub) {
    let sub = H * 0.17
    g.font = `600 ${sub}px ${FONT}`
    const sw = g.measureText(s.sub).width
    if (sw > avail) { sub *= avail / sw; g.font = `600 ${sub}px ${FONT}` }
    g.globalAlpha = 0.85
    g.fillText(s.sub, cx, H * 0.74)
    g.globalAlpha = 1
  }
}

function drawIcon(g: CanvasRenderingContext2D, icon: SignIcon, x: number, y: number, r: number, c: string, bg: string) {
  g.save()
  g.translate(x, y)
  g.fillStyle = c
  g.strokeStyle = c
  g.lineCap = "round"
  g.lineJoin = "round"
  g.lineWidth = r * 0.16
  const circle = () => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill() }
  switch (icon) {
    case "pole": {
      g.beginPath(); g.roundRect(-r * 0.32, -r, r * 0.64, r * 2, r * 0.3); g.fillStyle = "#ffffff"; g.fill()
      g.save(); g.clip()
      for (let i = -4; i < 5; i++) {
        g.fillStyle = i % 2 ? "#d8342c" : "#2b5fb3"
        g.beginPath(); g.moveTo(-r, i * r * 0.45); g.lineTo(r, i * r * 0.45 - r * 0.6); g.lineTo(r, i * r * 0.45 - r * 0.4); g.lineTo(-r, i * r * 0.45 + r * 0.2); g.fill()
      }
      g.restore()
      break
    }
    case "cross":
      circle()
      g.fillStyle = bg
      g.fillRect(-r * 0.2, -r * 0.62, r * 0.4, r * 1.24)
      g.fillRect(-r * 0.62, -r * 0.2, r * 1.24, r * 0.4)
      break
    case "bread":
      g.beginPath(); g.ellipse(0, 0, r, r * 0.62, -0.35, 0, Math.PI * 2); g.fill()
      g.strokeStyle = bg
      for (const d of [-0.45, 0, 0.45]) { g.beginPath(); g.moveTo(d * r - r * 0.12, -r * 0.3); g.lineTo(d * r + r * 0.12, r * 0.3); g.stroke() }
      break
    case "knife":
      g.beginPath(); g.moveTo(-r, r * 0.25); g.lineTo(r * 0.35, -r * 0.55); g.lineTo(r * 0.35, r * 0.25); g.closePath(); g.fill()
      g.fillRect(r * 0.35, -r * 0.05, r * 0.65, r * 0.3)
      break
    case "pencil":
      g.rotate(-0.7)
      g.fillRect(-r * 0.8, -r * 0.2, r * 1.3, r * 0.4)
      g.beginPath(); g.moveTo(r * 0.5, -r * 0.2); g.lineTo(r, 0); g.lineTo(r * 0.5, r * 0.2); g.fill()
      break
    case "cup":
      g.beginPath(); g.moveTo(-r * 0.6, -r * 0.4); g.lineTo(r * 0.6, -r * 0.4); g.lineTo(r * 0.4, r * 0.7); g.lineTo(-r * 0.4, r * 0.7); g.closePath(); g.fill()
      g.beginPath(); g.arc(r * 0.62, 0, r * 0.3, -Math.PI / 2, Math.PI / 2); g.stroke()
      g.beginPath(); g.moveTo(-r * 0.2, -r * 0.65); g.quadraticCurveTo(0, -r, -r * 0.1, -r * 1.05); g.stroke()
      break
    case "needle":
      g.beginPath(); g.moveTo(-r, r); g.lineTo(r * 0.9, -r * 0.9); g.stroke()
      g.beginPath(); g.arc(r * 0.72, -r * 0.72, r * 0.18, 0, Math.PI * 2); g.strokeStyle = bg; g.lineWidth = r * 0.08; g.stroke()
      g.strokeStyle = c; g.lineWidth = r * 0.1
      g.beginPath(); g.moveTo(-r * 0.2, r * 0.2); g.bezierCurveTo(r * 0.8, r * 0.9, -r * 0.9, r * 0.4, -r * 0.3, r * 0.9); g.stroke()
      break
    case "flower":
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        g.beginPath(); g.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.38, 0, Math.PI * 2); g.fill()
      }
      g.fillStyle = bg; g.beginPath(); g.arc(0, 0, r * 0.25, 0, Math.PI * 2); g.fill()
      break
    case "phone":
      g.beginPath(); g.roundRect(-r * 0.5, -r, r, r * 2, r * 0.18); g.fill()
      g.fillStyle = bg; g.fillRect(-r * 0.36, -r * 0.78, r * 0.72, r * 1.4)
      break
    case "cart":
      g.beginPath(); g.moveTo(-r, -r * 0.6); g.lineTo(-r * 0.6, -r * 0.6); g.lineTo(-r * 0.35, r * 0.35); g.lineTo(r * 0.75, r * 0.35); g.lineTo(r, -r * 0.35); g.lineTo(-r * 0.5, -r * 0.35); g.stroke()
      for (const d of [-0.2, 0.6]) { g.beginPath(); g.arc(d * r, r * 0.7, r * 0.15, 0, Math.PI * 2); g.fill() }
      break
    case "pot":
      g.fillRect(-r * 0.75, -r * 0.2, r * 1.5, r * 0.8)
      g.fillRect(-r * 0.9, -r * 0.35, r * 1.8, r * 0.18)
      g.fillRect(-r * 0.15, -r * 0.55, r * 0.3, r * 0.2)
      break
    case "helmet":
      g.beginPath(); g.arc(0, r * 0.25, r * 0.8, Math.PI, 0); g.fill()
      g.fillRect(-r, r * 0.2, r * 2, r * 0.22)
      break
    case "ball":
      circle()
      g.fillStyle = bg
      g.beginPath()
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * Math.PI * 2; g.lineTo(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36) }
      g.fill()
      break
  }
  g.restore()
}
