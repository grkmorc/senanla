/** Isometric orthographic camera rig: 90° yaw steps, zoom, pan, smooth follow. */
import { OrthographicCamera, Vector3, MathUtils } from "three"

const ISO_PITCH = Math.atan(1 / Math.SQRT2) // true isometric: 35.264°

export class IsoCameraRig {
  readonly camera: OrthographicCamera
  readonly focus = new Vector3()
  follow = true
  /** Half of the visible world height in metres. */
  zoom = 6.5
  minZoom = 2.5
  maxZoom = 12
  /** Ground-plane limits for the camera focus. */
  bounds = { minX: -8, maxX: 8, minZ: -7, maxZ: 7 }
  private yawIndex = 0
  private yaw = Math.PI / 4
  private aspect: number
  private readonly distance = 40

  constructor(aspect: number) {
    this.aspect = aspect
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    this.applyFrustum()
  }

  setAspect(aspect: number) { this.aspect = aspect; this.applyFrustum() }

  rotateStep(dir: number) { this.yawIndex += dir }

  zoomBy(factor: number) { this.zoom = MathUtils.clamp(this.zoom * factor, this.minZoom, this.maxZoom) }

  /** Pan by screen pixels; converts to ground-plane metres for the current zoom and yaw. */
  panPixels(dx: number, dy: number, viewportHeight: number) {
    this.follow = false
    const mPerPx = (2 * this.zoom) / viewportHeight
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const fwd = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    // Vertical screen motion maps onto the ground foreshortened by sin(pitch).
    this.focus.addScaledVector(right, -dx * mPerPx)
    this.focus.addScaledVector(fwd, (dy * mPerPx) / Math.sin(ISO_PITCH))
    this.clampFocus()
  }

  clampFocus() {
    this.focus.x = MathUtils.clamp(this.focus.x, this.bounds.minX, this.bounds.maxX)
    this.focus.z = MathUtils.clamp(this.focus.z, this.bounds.minZ, this.bounds.maxZ)
  }

  /** Jump to the target state without easing (deterministic captures). */
  snap() {
    this.yaw = Math.PI / 4 + (this.yawIndex * Math.PI) / 2
    this.place()
  }

  update(dt: number) {
    const target = Math.PI / 4 + (this.yawIndex * Math.PI) / 2
    this.yaw += (target - this.yaw) * (1 - Math.exp(-dt * 10))
    this.place()
  }

  private place() {
    const cp = Math.cos(ISO_PITCH)
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * cp * this.distance,
      this.focus.y + Math.sin(ISO_PITCH) * this.distance,
      this.focus.z + Math.cos(this.yaw) * cp * this.distance,
    )
    this.camera.lookAt(this.focus)
    this.applyFrustum()
  }

  private applyFrustum() {
    const c = this.camera
    c.top = this.zoom
    c.bottom = -this.zoom
    c.left = -this.zoom * this.aspect
    c.right = this.zoom * this.aspect
    c.updateProjectionMatrix()
  }
}
