// The klin mark and wordmark as vector geometry.
//
// The mark is a K drawn as a dependency graph: five package nodes on a grid
// (stem top, middle and bottom; arm and leg ends), joined by wires at 0° and
// 45° — the shape of a monorepo. The wordmark is a geometric lowercase "klin"
// whose k shares the mark's 45° chevron.
//
// Coordinates are screen space (y down). Every outline is clockwise, so the
// overlapping parts of one path fill as a union.

const f = (n) => {
  const s = (Math.round(n * 100) / 100).toString()
  return s === "-0" ? "0" : s
}
export { f }

const P = (x, y, r = 0) => ({ x, y, r })
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a, k) => ({ x: a.x * k, y: a.y * k })
const len = (a) => Math.hypot(a.x, a.y)
const norm = (a) => mul(a, 1 / len(a))
const dot = (a, b) => a.x * b.x + a.y * b.y
const cross = (a, b) => a.x * b.y - a.y * b.x

/** Where lines p + t·d and q + s·e cross. */
function meet(p, d, q, e) {
  return add(p, mul(d, cross(sub(q, p), e) / cross(d, e)))
}

/** A clockwise polygon with each corner rounded by its vertex's `r`, as path data. */
function outline(verts) {
  const n = verts.length
  const corners = verts.map((B, i) => {
    const A = verts[(i - 1 + n) % n]
    const C = verts[(i + 1) % n]
    const u1 = norm(sub(A, B))
    const u2 = norm(sub(C, B))
    const theta = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2))))
    if (!B.r) return { T1: B, T2: B }
    const t = B.r / Math.tan(theta / 2)
    return { T1: add(B, mul(u1, t)), T2: add(B, mul(u2, t)), r: B.r, cw: cross(sub(B, A), sub(C, B)) > 0 }
  })
  let d = `M${f(corners[0].T2.x)} ${f(corners[0].T2.y)}`
  for (let i = 1; i <= n; i++) {
    const c = corners[i % n]
    d += `L${f(c.T1.x)} ${f(c.T1.y)}`
    if (c.r) d += `A${f(c.r)} ${f(c.r)} 0 0 ${c.cw ? 1 : 0} ${f(c.T2.x)} ${f(c.T2.y)}`
  }
  return d + "Z"
}

/** Makes an outline clockwise on screen. */
function clockwise(verts) {
  let a = 0
  for (let i = 0; i < verts.length; i++) a += cross(verts[i], verts[(i + 1) % verts.length])
  return a >= 0 ? verts : [...verts].reverse()
}

/**
 * The graph mark. `u` is the grid step, `n` the node size, `e` the wire width
 * and `rn` the node corner radius. The small-size cut thickens the wires.
 */
export function mark({ u = 50, n = 46, e = 14, rn = 10 } = {}) {
  const at = (cx, cy) => ({ x: cx * u, y: cy * u })
  const T = at(0, 0), J = at(0, 2), B = at(0, 4), A = at(2, 0), L = at(2, 4)
  const node = (c) => [P(c.x - n / 2, c.y - n / 2, rn), P(c.x + n / 2, c.y - n / 2, rn), P(c.x + n / 2, c.y + n / 2, rn), P(c.x - n / 2, c.y + n / 2, rn)]
  const wire = (p, q) => {
    const d = norm(sub(q, p))
    const o = { x: -d.y * (e / 2), y: d.x * (e / 2) }
    return clockwise([P(p.x + o.x, p.y + o.y), P(q.x + o.x, q.y + o.y), P(q.x - o.x, q.y - o.y), P(p.x - o.x, p.y - o.y)])
  }
  const d = [wire(T, B), wire(J, A), wire(J, L)].map(outline).join("") + [T, J, B, A, L].map((c) => outline(node(c))).join("")
  const h = n / 2
  return { d, box: { x0: -h, y0: -h, x1: 2 * u + h, y1: 4 * u + h } }
}

/** The geometric lowercase "klin" (baseline y = 0, ascender 180). */
export function wordmark({ s = 26, asc = 180, xh = 124, t = 24 } = {}) {
  const parts = []
  // k: a stem and a 45° chevron whose point sits inside the stem; arm and leg reach equally far.
  const p = 8
  const vy = -xh / 2
  const ya = vy - p
  const yl = vy + p
  const w = t * Math.SQRT2
  const armTL = { x: s + (xh + ya), y: -xh }
  const armTR = { x: armTL.x + w, y: -xh }
  const legBL = { x: s - yl, y: 0 }
  const legBR = { x: legBL.x + w, y: 0 }
  const crotch = meet(armTR, { x: -1, y: 1 }, legBR, { x: -1, y: -1 })
  parts.push(
    outline([
      P(0, -asc, 3), P(s, -asc, 3), P(s, ya, 2), P(armTL.x, armTL.y, 3), P(armTR.x, armTR.y, 3),
      P(crotch.x, crotch.y, 3), P(legBR.x, 0, 3), P(legBL.x, 0, 3), P(s, yl, 2), P(s, 0, 3), P(0, 0, 3),
    ]),
  )
  let x = armTR.x + 14
  // l
  parts.push(outline([P(x, -asc, 3), P(x + s, -asc, 3), P(x + s, 0, 3), P(x, 0, 3)]))
  x += s + 26
  // i, with a round dot
  parts.push(outline([P(x, -xh, 3), P(x + s, -xh, 3), P(x + s, 0, 3), P(x, 0, 3)]))
  const cy = -xh - 22 - s / 2
  parts.push(`M${f(x)} ${f(cy)}A${s / 2} ${s / 2} 0 1 1 ${f(x + s)} ${f(cy)}A${s / 2} ${s / 2} 0 1 1 ${f(x)} ${f(cy)}Z`)
  x += s + 26
  // n: a stem, an arch (outer radius R) and a second stem
  const R = 48
  const cx = x + R
  const ay = -xh - 2 + R
  const ri = R - s
  parts.push(outline([P(x, -xh, 3), P(x + s, -xh, 0), P(x + s, 0, 3), P(x, 0, 3)]))
  parts.push(
    `M${f(x)} ${f(ay)}A${R} ${R} 0 0 1 ${f(cx + R)} ${f(ay)}V-3A3 3 0 0 1 ${f(cx + R - 3)} 0H${f(cx + R - s + 3)}` +
      `A3 3 0 0 1 ${f(cx + R - s)} -3V${f(ay)}A${ri} ${ri} 0 0 0 ${f(x + s)} ${f(ay)}Z`,
  )
  x += 2 * R
  return { d: parts.join(""), width: x, asc }
}
