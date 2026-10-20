// The klin mark and wordmark as vector geometry.
//
// The mark is an egg with its first crack, the cap lifted: something new
// hatching. The shell's top half is half an ellipse, its bottom a half
// circle; the crack runs level in from both sides, then zigzags in three 45°
// teeth; the cap sits a little above the shell, an even gap apart. The
// wordmark is a geometric lowercase "klin".
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

/** Offsets an open polyline sideways by `d` (positive = left of travel, i.e. up for a line running right), mitred. */
function offsetLine(pts, d) {
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    const dir = norm(sub(pts[i + 1], pts[i]))
    const n = { x: dir.y * d, y: -dir.x * d }
    segs.push({ p: add(pts[i], n), q: add(pts[i + 1], n), dir })
  }
  const out = [segs[0].p]
  for (let i = 1; i < segs.length; i++) out.push(meet(segs[i - 1].p, segs[i - 1].dir, segs[i].p, segs[i].dir))
  out.push(segs[segs.length - 1].q)
  return out
}

/**
 * The egg mark, centred on x = 0 with the shell's widest point at y = 0.
 * `rx` is the half-width, `ry` the height of the top half, `yc` the crack's
 * level, `tooth` its teeth's width (and depth), `g` the gap along the crack
 * and `lift` how far the cap sits above the shell. The small-size cut opens
 * the gap and the lift. Returns the cap and the shell as separate paths (the
 * website animates the cap) and both together as `d`.
 */
export function mark({ rx = 76, ry = 102, yc = -50, tooth = 26, g = 12, lift = 12 } = {}) {
  /** Where the top half's outline is at height y (y ≤ 0), on the left (-1) or right (1). */
  const xAt = (y, side) => side * rx * Math.sqrt(1 - (y / ry) ** 2)
  const xs = [-2, -1, 0, 1, 2].map((k) => k * tooth)
  const crack = [P(xAt(yc, -1), yc), ...xs.map((x, i) => P(x, i % 2 ? yc + tooth : yc)), P(xAt(yc, 1), yc)]
  // The crack's level ends move with the offset, so they're put back on the outline.
  const ends = (pts) => {
    const out = [...pts]
    out[0] = P(xAt(out[0].y, -1), out[0].y)
    out[out.length - 1] = P(xAt(out[out.length - 1].y, 1), out[out.length - 1].y)
    return out
  }
  const up = ends(offsetLine(crack, g / 2)).map((p) => P(p.x, p.y - lift))
  const dn = ends(offsetLine(crack, -g / 2))
  const line = (pts) => pts.map((p) => `L${f(p.x)} ${f(p.y)}`).join("")
  const shell =
    `M${f(dn[0].x)} ${f(dn[0].y)}${line(dn.slice(1))}` +
    `A${rx} ${ry} 0 0 1 ${rx} 0A${rx} ${rx} 0 0 1 0 ${rx}A${rx} ${rx} 0 0 1 ${-rx} 0` +
    `A${rx} ${ry} 0 0 1 ${f(dn[0].x)} ${f(dn[0].y)}Z`
  const last = up[up.length - 1]
  const cap = `M${f(up[0].x)} ${f(up[0].y)}A${rx} ${ry} 0 0 1 ${f(last.x)} ${f(last.y)}${line(up.slice(0, -1).reverse())}Z`
  return { d: cap + shell, cap, shell, box: { x0: -rx, y0: -ry - lift, x1: rx, y1: rx } }
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
