/** Uniform grid navigation: 8-way A* without corner cutting, plus line-of-sight smoothing. */
export class NavGrid {
  readonly cols: number
  readonly rows: number
  private blocked: Uint8Array

  constructor(
    readonly minX: number, readonly minZ: number,
    readonly maxX: number, readonly maxZ: number,
    readonly cell: number,
  ) {
    this.cols = Math.ceil((maxX - minX) / cell)
    this.rows = Math.ceil((maxZ - minZ) / cell)
    this.blocked = new Uint8Array(this.cols * this.rows)
  }

  private cx(x: number) { return Math.floor((x - this.minX) / this.cell) }
  private cz(z: number) { return Math.floor((z - this.minZ) / this.cell) }
  private centre(i: number, j: number): [number, number] {
    return [this.minX + (i + 0.5) * this.cell, this.minZ + (j + 0.5) * this.cell]
  }
  private inside(i: number, j: number) { return i >= 0 && j >= 0 && i < this.cols && j < this.rows }
  isFree(i: number, j: number) { return this.inside(i, j) && !this.blocked[j * this.cols + i] }

  /** Block an axis-aligned rectangle grown by `pad` (agent radius). */
  blockRect(x0: number, z0: number, x1: number, z1: number, pad = 0) {
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const [x, z] = this.centre(i, j)
        if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) this.blocked[j * this.cols + i] = 1
      }
    }
  }

  /** Block cells whose centre is closer than `pad` to the grid border. */
  blockBorder(pad: number) {
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const [x, z] = this.centre(i, j)
        if (x < this.minX + pad || x > this.maxX - pad || z < this.minZ + pad || z > this.maxZ - pad) this.blocked[j * this.cols + i] = 1
      }
    }
  }

  private nearestFree(i: number, j: number): [number, number] | null {
    if (this.isFree(i, j)) return [i, j]
    for (let r = 1; r < 12; r++) {
      let best: [number, number] | null = null
      let bd = Infinity
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this.isFree(i + di, j + dj)) continue
        const d = di * di + dj * dj
        if (d < bd) { bd = d; best = [i + di, j + dj] }
      }
      if (best) return best
    }
    return null
  }

  private lineFree(ax: number, az: number, bx: number, bz: number) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (this.cell * 0.35))
    for (let s = 0; s <= steps; s++) {
      const t = s / Math.max(1, steps)
      if (!this.isFree(this.cx(ax + (bx - ax) * t), this.cz(az + (bz - az) * t))) return false
    }
    return true
  }

  /** Returns world-space waypoints (excluding the start) or null when unreachable. */
  findPath(sx: number, sz: number, tx: number, tz: number): [number, number][] | null {
    const start = this.nearestFree(this.cx(sx), this.cz(sz))
    const goal = this.nearestFree(this.cx(tx), this.cz(tz))
    if (!start || !goal) return null
    const N = this.cols * this.rows
    const g = new Float32Array(N).fill(Infinity)
    const came = new Int32Array(N).fill(-1)
    const closed = new Uint8Array(N)
    const idx = (i: number, j: number) => j * this.cols + i
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - goal[0]), dz = Math.abs(j - goal[1])
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)
    }
    // Binary heap on f.
    const heap: number[] = []
    const f = new Float32Array(N).fill(Infinity)
    const push = (n: number) => {
      heap.push(n)
      let c = heap.length - 1
      while (c > 0) { const p = (c - 1) >> 1; if (f[heap[p]] <= f[heap[c]]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p }
    }
    const pop = () => {
      const top = heap[0]; const end = heap.pop()!
      if (heap.length) {
        heap[0] = end; let c = 0
        for (;;) {
          const l = 2 * c + 1, r = l + 1; let m = c
          if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l
          if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r
          if (m === c) break
          ;[heap[m], heap[c]] = [heap[c], heap[m]]; c = m
        }
      }
      return top
    }
    const s = idx(start[0], start[1])
    const t = idx(goal[0], goal[1])
    g[s] = 0; f[s] = h(start[0], start[1]); push(s)
    while (heap.length) {
      const cur = pop()
      if (cur === t) break
      if (closed[cur]) continue
      closed[cur] = 1
      const ci = cur % this.cols, cj = (cur / this.cols) | 0
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = ci + di, nj = cj + dj
        if (!this.isFree(ni, nj)) continue
        if (di && dj && (!this.isFree(ci + di, cj) || !this.isFree(ci, cj + dj))) continue
        const n = idx(ni, nj)
        const ng = g[cur] + (di && dj ? Math.SQRT2 : 1)
        if (ng < g[n]) { g[n] = ng; f[n] = ng + h(ni, nj); came[n] = cur; push(n) }
      }
    }
    if (s !== t && came[t] < 0) return null

    const cells: [number, number][] = []
    for (let n = t; n !== -1; n = came[n]) {
      cells.push(this.centre(n % this.cols, (n / this.cols) | 0))
      if (n === s) break
    }
    cells.reverse()
    // Use the exact click point when it lies in a free cell.
    const exactGoal = this.isFree(this.cx(tx), this.cz(tz))
    if (exactGoal) cells[cells.length - 1] = [tx, tz]
    // String-pull.
    const out: [number, number][] = []
    let ax = sx, az = sz, k = 0
    while (k < cells.length) {
      let far = k
      for (let m = cells.length - 1; m > k; m--) {
        if (this.lineFree(ax, az, cells[m][0], cells[m][1])) { far = m; break }
      }
      out.push(cells[far])
      ;[ax, az] = cells[far]
      k = far + 1
    }
    return out
  }
}
