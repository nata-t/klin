// Fifteen candidate marks for klin, none of them a K.
//
// Every mark is drawn on a 256 × 256 canvas (y down) and returned as
// { d, box }: one path for the whole mark, filled with the nonzero rule, and
// the box its ink actually covers (for lockups). Solid parts wind clockwise,
// holes counter-clockwise.

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
const rad = (deg) => (deg * Math.PI) / 180
const polar = (c, r, deg) => ({ x: c.x + r * Math.cos(rad(deg)), y: c.y + r * Math.sin(rad(deg)) })

/** Where lines p + t·d and q + s·e cross. */
function meet(p, d, q, e) {
  return add(p, mul(d, cross(sub(q, p), e) / cross(d, e)))
}

/** Signed area, positive when the polygon runs clockwise on screen. */
function area(verts) {
  let a = 0
  for (let i = 0; i < verts.length; i++) a += cross(verts[i], verts[(i + 1) % verts.length])
  return a / 2
}

/** A polygon with each corner rounded by its vertex's `r`, as path data. Winding follows `cw`. */
function outline(input, cw = true) {
  const verts = area(input) >= 0 === cw ? input : [...input].reverse()
  const n = verts.length
  const corners = verts.map((B, i) => {
    const A = verts[(i - 1 + n) % n]
    const C = verts[(i + 1) % n]
    if (!B.r) return { T1: B, T2: B }
    const u1 = norm(sub(A, B))
    const u2 = norm(sub(C, B))
    const theta = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2))))
    const t = B.r / Math.tan(theta / 2)
    return { T1: add(B, mul(u1, t)), T2: add(B, mul(u2, t)), r: B.r, sweep: cross(sub(B, A), sub(C, B)) > 0 ? 1 : 0 }
  })
  let d = `M${f(corners[0].T2.x)} ${f(corners[0].T2.y)}`
  for (let i = 1; i <= n; i++) {
    const c = corners[i % n]
    d += `L${f(c.T1.x)} ${f(c.T1.y)}`
    if (c.r) d += `A${f(c.r)} ${f(c.r)} 0 0 ${c.sweep} ${f(c.T2.x)} ${f(c.T2.y)}`
  }
  return d + "Z"
}

/** A rounded rectangle; `r` is one radius or [tl, tr, br, bl]. */
function rrect(x, y, w, h, r = 0, cw = true) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r]
  return outline([P(x, y, a), P(x + w, y, b), P(x + w, y + h, c), P(x, y + h, d)], cw)
}

function circle(cx, cy, r, cw = true) {
  const s = cw ? 1 : 0
  return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 ${s} ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 ${s} ${f(cx - r)} ${f(cy)}Z`
}

/** A ring: a disc with a hole. */
function ring(cx, cy, r, w) {
  return circle(cx, cy, r + w / 2) + circle(cx, cy, r - w / 2, false)
}

/** A straight stroke of width `w` from p to q with round caps. */
function capsule(p, q, w, cw = true) {
  const dir = norm(sub(q, p))
  let n = { x: (-dir.y * w) / 2, y: (dir.x * w) / 2 }
  let pts = [add(p, n), add(q, n), sub(q, n), sub(p, n)]
  if (area(pts) >= 0 !== cw) {
    n = mul(n, -1)
    pts = [add(p, n), add(q, n), sub(q, n), sub(p, n)]
  }
  const [a, b, c, e] = pts
  const s = cw ? 1 : 0
  const r = f(w / 2)
  return `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}A${r} ${r} 0 0 ${s} ${f(c.x)} ${f(c.y)}L${f(e.x)} ${f(e.y)}A${r} ${r} 0 0 ${s} ${f(a.x)} ${f(a.y)}Z`
}

/** Moves path data (M, L, A and Z only) by dx, dy. */
function shift(d, dx, dy) {
  return d.replace(/([MLA])([^MLAZ]*)/g, (_, c, args) => {
    const v = args.trim().split(/[ ,]+/).map(Number)
    v[v.length - 2] += dx
    v[v.length - 1] += dy
    return c + (c === "A" ? `${v.slice(0, 5).join(" ")} ${f(v[5])} ${f(v[6])}` : `${f(v[0])} ${f(v[1])}`)
  })
}

/** A stroke of width `w` along a circle of radius `r` from a0° to a1° (clockwise on screen), round caps. */
function arcBand(c, r, w, a0, a1) {
  const ro = r + w / 2
  const ri = r - w / 2
  const large = a1 - a0 > 180 ? 1 : 0
  const p0 = polar(c, ro, a0)
  const p1 = polar(c, ro, a1)
  const q1 = polar(c, ri, a1)
  const q0 = polar(c, ri, a0)
  const h = w / 2
  return (
    `M${f(p0.x)} ${f(p0.y)}A${f(ro)} ${f(ro)} 0 ${large} 1 ${f(p1.x)} ${f(p1.y)}` +
    `A${f(h)} ${f(h)} 0 0 1 ${f(q1.x)} ${f(q1.y)}A${f(ri)} ${f(ri)} 0 ${large} 0 ${f(q0.x)} ${f(q0.y)}` +
    `A${f(h)} ${f(h)} 0 0 1 ${f(p0.x)} ${f(p0.y)}Z`
  )
}

/** Moves a convex polygon's edges inward by `d` (to open an even gap between tiles). */
function inset(verts, d) {
  const c = mul(verts.reduce(add, { x: 0, y: 0 }), 1 / verts.length)
  const n = verts.length
  const lines = verts.map((A, i) => {
    const B = verts[(i + 1) % n]
    const dir = norm(sub(B, A))
    let nrm = { x: -dir.y, y: dir.x }
    if (dot(nrm, sub(c, A)) < 0) nrm = mul(nrm, -1)
    return { p: add(A, mul(nrm, d)), dir }
  })
  return lines.map((L, i) => {
    const prev = lines[(i - 1 + n) % n]
    const q = meet(prev.p, prev.dir, L.p, L.dir)
    return P(q.x, q.y, verts[i].r)
  })
}

/** Offsets an open polyline sideways by `d` (positive = left of travel on screen), mitred. */
function offsetLine(pts, d) {
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    const dir = norm(sub(pts[i + 1], pts[i]))
    const nrm = { x: dir.y, y: -dir.x }
    segs.push({ p: add(pts[i], mul(nrm, d)), q: add(pts[i + 1], mul(nrm, d)), dir })
  }
  const out = [segs[0].p]
  for (let i = 1; i < segs.length; i++) out.push(meet(segs[i - 1].p, segs[i - 1].dir, segs[i].p, segs[i].dir))
  out.push(segs[segs.length - 1].q)
  return out
}

const rot90 = (p, k) => {
  // Quarter turns clockwise about the canvas centre.
  let { x, y } = p
  for (let i = 0; i < k; i++) [x, y] = [256 - y, x]
  return { x, y }
}

// ---------------------------------------------------------------------------

/** 01 · Glint — four quarter-round tiles; the gap between them is a sparkle. */
export function glint({ R = 104, g = 12, rc = 22 } = {}) {
  const a = 24
  const e = 128 - g / 2 - a // how far a tile reaches along an edge
  const t = R > e ? Math.sqrt(R * R - e * e) : 0
  const tile = (k) => {
    const pt = (x, y) => rot90({ x, y }, k)
    const pts = []
    const M = pt(a + rc, a)
    let d = `M${f(M.x)} ${f(M.y)}`
    const L = (x, y) => {
      const p = pt(x, y)
      d += `L${f(p.x)} ${f(p.y)}`
    }
    const A = (r, x, y, large = 0, sweep = 1) => {
      const p = pt(x, y)
      d += `A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(p.x)} ${f(p.y)}`
    }
    if (R > e) {
      L(a + e, a)
      L(a + e, a + t)
      A(R, a + t, a + e)
      L(a, a + e)
    } else {
      L(a + R, a)
      A(R, a, a + R)
    }
    L(a, a + rc)
    A(rc, a + rc, a)
    pts.push(d + "Z")
    return pts.join("")
  }
  return { d: [0, 1, 2, 3].map(tile).join(""), box: [24, 24, 232, 232] }
}

/** 02 · Dovetail — a front block and a back block locked by dovetails. */
export function dovetail({ g = 14, y = 160, tails = [80, 176], root = 16, rise = 72, flare = 15, turn = 0 } = {}) {
  const top = root + rise * Math.tan(rad(flare)) // tails flare at a clean 15°
  const seam = [P(24, y)]
  for (const cx of tails) seam.push(P(cx - root, y), P(cx - top, y - rise), P(cx + top, y - rise), P(cx + root, y))
  seam.push(P(232, y))
  const up = offsetLine(seam, g / 2)
  const dn = offsetLine(seam, -g / 2)
  const ri = 5
  const inner = (p, i, all) => P(p.x, p.y, i === 0 || i === all.length - 1 ? 0 : ri)
  const upper = [P(24, 24, 28), P(232, 24, 28), ...up.reverse().map(inner)]
  const lower = [...dn.map(inner), P(232, 232, 28), P(24, 232, 28)]
  const t = (v) => v.map((p) => ({ ...rot90(p, turn), r: p.r }))
  return { d: outline(t(upper)) + outline(t(lower)), box: [24, 24, 232, 232] }
}

/** 03 · Swept — a grid of spots with one clean diagonal wiped through it. */
export function swept({ n = 5, pitch = 46, r = 16, band = [4], shrink = 0 } = {}) {
  const start = 128 - (pitch * (n - 1)) / 2
  let d = ""
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const k = i + j
      if (band.includes(k)) continue
      const near = band.includes(k + 1) || band.includes(k - 1)
      d += circle(start + j * pitch, start + i * pitch, near && shrink ? shrink : r)
    }
  const lo = start - r
  const hi = start + pitch * (n - 1) + r
  return { d, box: [lo, lo, hi, hi] }
}

/** 04 · Cairn — three stones balanced: database, API, web. */
export function cairn({ g = 12 } = {}) {
  const stones = [
    { w: 96, h: 50, cx: 136 },
    { w: 152, h: 56, cx: 120 },
    { w: 208, h: 62, cx: 128 },
  ]
  const total = stones.reduce((s, st) => s + st.h, 0) + g * (stones.length - 1)
  let y = 128 - total / 2
  let d = ""
  for (const st of stones) {
    d += rrect(st.cx - st.w / 2, y, st.w, st.h, st.h / 2)
    y += st.h + g
  }
  return { d, box: [24, 128 - total / 2, 232, 128 + total / 2] }
}

/** 05 · Bubbles — soap bubbles, the big one with a shine. */
export function bubbles() {
  const big = { x: 100, y: 152 }
  let d = ring(big.x, big.y, 68, 20)
  d += arcBand(big, 40, 14, 198, 252)
  d += ring(194, 58, 34, 16)
  d += circle(206, 154, 14)
  return { d, box: [22, 16, 236, 230] }
}

/** 06 · Cursor — an empty screen with the cursor waiting at the start of the line. */
export function cursor({ ro = 30 } = {}) {
  const d = rrect(24, 24, 208, 208, ro) + rrect(66, 108, 52, 92, 4, false)
  return { d, box: [24, 24, 232, 232] }
}

/** The cursor drawn for the lockup, where it follows the word (top-left at 0,0). */
export function cursorBlock({ w = 92, h = 180 } = {}) {
  return { d: rrect(0, 0, w, h, 6), w, h }
}

/** 07 · Peel — the protective film peeling off a brand-new screen. */
export function peel({ R = 112, g = 14, rc = 28 } = {}) {
  const C = { x: 232, y: 24 } // the corner that lifted
  const Rg = R + g
  // The sheet: the rounded square with a quarter disc taken out of that corner.
  const sheet =
    `M${f(24 + rc)} 24L${f(C.x - Rg)} 24A${f(Rg)} ${f(Rg)} 0 0 0 232 ${f(C.y + Rg)}` +
    `L232 ${f(232 - rc)}A${rc} ${rc} 0 0 1 ${f(232 - rc)} 232L${f(24 + rc)} 232A${rc} ${rc} 0 0 1 24 ${f(232 - rc)}` +
    `L24 ${f(24 + rc)}A${rc} ${rc} 0 0 1 ${f(24 + rc)} 24Z`
  // The curl: the corner folded over its own diagonal, one even gap from the sheet.
  const A = { x: C.x - R, y: 24 }
  const B = { x: 232, y: C.y + R }
  const flap = `M${f(A.x)} ${f(A.y)}L${f(B.x)} ${f(B.y)}A${R} ${R} 0 0 1 ${f(A.x)} ${f(A.y)}Z`
  return { d: sheet + flap, box: [24, 24, 232, 232] }
}

/** 08 · Hatch — a smooth, spotless egg with its first crack: something new is starting. */
export function hatch({ rx = 76, ry = 102, cy = 144, yc = 94, tooth = 26, g = 12, lift = 12 } = {}) {
  const cx = 128
  const xAt = (y, side) => cx + side * rx * Math.sqrt(1 - ((y - cy) / ry) ** 2)
  // The crack: level at both ends, three teeth at 45° in between.
  const xs = [-2, -1, 0, 1, 2].map((k) => cx + k * tooth)
  const crack = [P(xAt(yc, -1), yc), ...xs.map((x, i) => P(x, i % 2 ? yc + tooth : yc)), P(xAt(yc, 1), yc)]
  const edge = (pts) => {
    const out = pts.map((p) => P(p.x, p.y))
    out[0] = P(xAt(out[0].y, -1), out[0].y)
    out[out.length - 1] = P(xAt(out[out.length - 1].y, 1), out[out.length - 1].y)
    return out
  }
  const up = edge(offsetLine(crack, g / 2))
  const dn = edge(offsetLine(crack, -g / 2))
  const pts = (list) => list.map((p) => `L${f(p.x)} ${f(p.y)}`).join("")
  const L = dn[0]
  const R = dn[dn.length - 1]
  const shell =
    `M${f(L.x)} ${f(L.y)}${pts(dn.slice(1))}` +
    `A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}A${rx} ${rx} 0 0 1 ${cx} ${cy + rx}A${rx} ${rx} 0 0 1 ${cx - rx} ${cy}` +
    `A${rx} ${ry} 0 0 1 ${f(L.x)} ${f(L.y)}Z`
  const U0 = up[0]
  const U1 = up[up.length - 1]
  const cap =
    `M${f(U0.x)} ${f(U0.y - lift)}A${rx} ${ry} 0 0 1 ${f(U1.x)} ${f(U1.y - lift)}` +
    pts(up.slice(0, -1).reverse().map((p) => P(p.x, p.y - lift))) + "Z"
  return { d: shell + cap, box: [cx - rx, cy - ry - lift, cx + rx, cy + rx] }
}

/** 09 · Bento — a place for everything, and one dashed slot waiting for what you generate next. */
export function bento({ g = 12, ro = 28, ri = 8, t = 12 } = {}) {
  const a = 24
  const b = 232
  const m = 128
  let d = ""
  d += rrect(a, a, m - g / 2 - a, b - a, [ro, ri, ri, ro])
  d += rrect(m + g / 2, a, b - m - g / 2, m - g / 2 - a, [ri, ro, ri, ri])
  // The empty slot, drawn as a dashed outline: four corners and a dash on each side.
  const x0 = m + g / 2
  const y0 = m + g / 2
  const s = b - x0
  const arm = 30
  const dash = 18
  const corner = (k) => {
    // Top-left corner bracket, then turned for the others.
    const L = [P(0, 0, 10), P(arm, 0, t / 2), P(arm, t, t / 2), P(t, t, 3), P(t, arm, t / 2), P(0, arm, t / 2)]
    if (k === 3) L[0].r = ro - 4
    return L.map((p) => {
      let { x, y } = p
      for (let i = 0; i < k; i++) [x, y] = [s - y, x]
      return P(x0 + x, y0 + y, p.r)
    })
  }
  for (let k = 0; k < 4; k++) d += outline(corner(k))
  const mid = (s - dash) / 2
  d += rrect(x0 + mid, y0, dash, t, t / 2) + rrect(x0 + mid, y0 + s - t, dash, t, t / 2)
  d += rrect(x0, y0 + mid, t, dash, t / 2) + rrect(x0 + s - t, y0 + mid, t, dash, t / 2)
  return { d, box: [a, a, b, b] }
}

/** 10 · Bowtie — sharp-dressed and ready; also ⋈, the join between front and back. */
export function bowtie({ kw = 28, kh = 56, g = 12, slope = 30 } = {}) {
  const c = 128
  const kx = c - kw / 2
  const ky = c - kh / 2
  let d = rrect(kx, ky, kw, kh, 8)
  const innerX = kx - g
  const ih = kh - 8
  const spread = (innerX - 24) * Math.tan(rad(slope))
  const oh = ih / 2 + spread
  const left = [P(24, c - oh, 16), P(innerX, c - ih / 2, 6), P(innerX, c + ih / 2, 6), P(24, c + oh, 16)]
  const right = left.map((p) => P(256 - p.x, p.y, p.r))
  d += outline(left) + outline(right)
  return { d, box: [24, c - oh, 232, c + oh] }
}

/** 11 · Spin — a washing machine on a clean cycle. */
export function spin({ lvl = 140, wr = 34 } = {}) {
  const body = rrect(28, 20, 200, 216, 30)
  // Holes: a dial slot and a knob along the top, and the porthole.
  const holes = rrect(54, 44, 58, 16, 8, false) + circle(194, 52, 10, false)
  const c = { x: 128, y: 148 }
  const porthole = circle(c.x, c.y, 72, false)
  // The water, inside the glass (r 60), below a gentle wave.
  const r = 60
  const dx = Math.sqrt(r * r - (lvl - c.y) ** 2)
  const L = { x: c.x - dx, y: lvl }
  const Rt = { x: c.x + dx, y: lvl }
  const step = (Rt.x - L.x) / 3
  let water = `M${f(L.x)} ${f(L.y)}`
  for (let i = 1; i <= 3; i++) water += `A${wr} ${wr} 0 0 ${i % 2} ${f(L.x + step * i)} ${f(lvl)}`
  water += `A${r} ${r} 0 1 1 ${f(L.x)} ${f(L.y)}Z`
  return { d: body + holes + porthole + water, box: [28, 20, 228, 236] }
}

/** 12 · Sprue — a model-kit frame: every part comes attached, ready to snap out. */
export function sprue({ t = 16, rh = 12, gate = 8 } = {}) {
  const a = 24
  const b = 232
  const mid = 128
  const i0 = a + t
  const i1 = b - t
  let d = rrect(a, a, b - a, b - a, 28)
  // Two windows either side of the runner, cut from the frame.
  d += rrect(i0, i0, i1 - i0, mid - rh / 2 - i0, [14, 14, 4, 4], false)
  d += rrect(i0, mid + rh / 2, i1 - i0, i1 - mid - rh / 2, [4, 4, 14, 14], false)
  // Parts, each held by two short gates.
  const ru = mid - rh / 2 // runner's top edge
  const rd = mid + rh / 2
  const disc = { x: 90, r: 30 }
  disc.y = ru - 12 - disc.r
  d += circle(disc.x, disc.y, disc.r)
  d += rrect(disc.x - gate / 2, disc.y + disc.r - 3, gate, ru - disc.y - disc.r + 4, 0)
  d += rrect(i0 - 1, disc.y - gate / 2, disc.x - disc.r - i0 + 4, gate, 0)
  const sq = { x: 138, y: rd + 12, s: 58 }
  d += rrect(sq.x, sq.y, sq.s, sq.s, 9)
  d += rrect(sq.x + sq.s / 2 - gate / 2, rd - 1, gate, 15, 0)
  d += rrect(sq.x + sq.s - 2, sq.y + sq.s / 2 - gate / 2, i1 - sq.x - sq.s + 3, gate, 0)
  return { d, box: [a, a, b, b] }
}

/** 13 · Tangram — seven pieces, one square; the last piece sliding home. */
export function tangram({ g = 12, slide = 14 } = {}) {
  const a = 24
  const s = 208
  const q = (x, y) => P(a + x * s, a + y * s, 3)
  const pieces = [
    [q(0, 0), q(1, 0), q(0.5, 0.5)],
    [q(0, 0), q(0.5, 0.5), q(0, 1)],
    [q(1, 0.5), q(1, 1), q(0.5, 1)],
    [q(1, 0), q(1, 0.5), q(0.75, 0.75), q(0.75, 0.25)],
    [q(0.5, 0.5), q(0.75, 0.25), q(0.75, 0.75)],
    [q(0.5, 0.5), q(0.75, 0.75), q(0.5, 1), q(0.25, 0.75)],
    [q(0.25, 0.75), q(0.5, 1), q(0, 1)],
  ]
  const moved = 2 // the medium corner triangle, still sliding in
  let d = ""
  pieces.forEach((pc, i) => {
    let v = inset(pc, g / 2)
    if (i === moved) v = v.map((p) => P(p.x + slide, p.y + slide, p.r))
    d += outline(v)
  })
  return { d, box: [a, a, a + s + slide, a + s + slide] }
}

/** The drop: a disc with one corner left sharp, flicked up and to the right. */
export function dropShape(cx, cy, r) {
  return `M${f(cx)} ${f(cy - r)}L${f(cx + r)} ${f(cy - r)}L${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx)} ${f(cy - r)}Z`
}

/** 14 · Droplet — the dot on the i is a drop of water; on its own, it's the icon. */
export function droplet() {
  const r = 86
  const cx = 128 - 6
  const cy = 128 + 6
  return { d: dropShape(cx, cy, r), box: [cx - r, cy - r, cx + r, cy + r] }
}

/** 15 · Weave — two threads woven through three layers: one schema holding the stack together. */
export function weave({ bh = 52, gap = 18, tw = 36, g = 9, ext = 20, threads = [84, 172], rb = 12, rt = 8 } = {}) {
  const c = 128
  const total = bh * 3 + gap * 2
  const y0 = c - total / 2
  const bars = [0, 1, 2].map((i) => y0 + i * (bh + gap))
  const a = 24
  const b = 232
  const r = rb ?? bh / 2
  const re = rt ?? tw / 2
  // over[t][i]: does thread t cross over bar i? Neighbours alternate, like a weave.
  const over = threads.map((_, t) => bars.map((_, i) => (t + i) % 2 === 0))
  let d = ""
  bars.forEach((y, i) => {
    const cuts = threads.filter((_, t) => over[t][i]).map((x) => [x - tw / 2 - g, x + tw / 2 + g])
    let x = a
    const spans = []
    for (const [l, rr] of cuts) {
      spans.push([x, l])
      x = rr
    }
    spans.push([x, b])
    spans.forEach(([l, rr], k) => {
      const first = k === 0
      const last = k === spans.length - 1
      d += rrect(l, y, rr - l, bh, [first ? r : 5, last ? r : 5, last ? r : 5, first ? r : 5])
    })
  })
  const top = y0 - ext
  const bot = y0 + total + ext
  threads.forEach((x, t) => {
    let y = top
    const ends = []
    bars.forEach((by, i) => {
      if (!over[t][i]) {
        ends.push([y, by - g])
        y = by + bh + g
      }
    })
    ends.push([y, bot])
    for (const [s0, s1] of ends) {
      if (s1 - s0 < 4) continue
      d += rrect(x - tw / 2, s0, tw, s1 - s0, [s0 === top ? re : 4, s0 === top ? re : 4, s1 === bot ? re : 4, s1 === bot ? re : 4])
    }
  })
  return { d, box: [a, top, b, bot] }
}

export const concepts = [
  { slug: "glint", optical: 0.94, name: "Glint", type: "Negative space", mark: glint, idea: "Four parts of a kit, fitted so the clean space between them shines.", why: ["Spotless, said with the gap, not the ink", "Four tiles: apps and packages in their places", "A plain square at 16 px, a sparkle up close"] },
  { slug: "dovetail", optical: 0.94, name: "Dovetail", type: "Abstract", mark: dovetail, idea: "Front end on top, back end below, locked by dovetails: the shared schema is the joint.", why: ["Full-stack in one picture", "Joinery: fits without glue, like typed code", "Two solid blocks, survives 16 px"] },
  { slug: "swept", optical: 1.0, name: "Swept", type: "Pattern", mark: swept, idea: "A grid of spots with one clean pass wiped through it: literally spot-less.", why: ["The name's promise, as a joke you get once", "Dots map to terminal pixels one to one", "Seeds patterns, loaders and backgrounds"] },
  { slug: "cairn", optical: 1.0, name: "Cairn", type: "Pictorial", mark: cairn, idea: "Three stones balanced: database, API, web. A full stack at rest, and a trail marker that shows where to start.", why: ["Calm and steady, not another rocket", "Stack and starter in one shape", "Three shapes: easy in pixels"] },
  { slug: "bubbles", optical: 1.04, name: "Bubbles", type: "Pictorial", mark: bubbles, idea: "Soap bubbles, one with a shine: clean, light, and a little playful.", why: ["Clean without a broom or a sparkle", "Rounds soften a very square category", "Big, medium, small reads as apps and packages"] },
  { slug: "cursor", optical: 0.94, name: "Cursor", type: "Typographic", mark: cursor, idea: "The block cursor follows the name, so the logo reads klin▌ as if you just typed it. The icon is an empty screen, cursor waiting.", why: ["Born in the terminal, where klin lives", "Nothing sits before the name, so nothing doubles", "Blinks in the CLI and on the website"] },
  { slug: "peel", optical: 0.94, name: "Peel", type: "Pictorial", mark: peel, idea: "The film peeling off a brand-new screen: nobody has touched this project yet.", why: ["Fresh out of the box, the starter feeling", "One curl, one idea", "A square silhouette for icons"] },
  { slug: "hatch", optical: 1.04, name: "Hatch", type: "Pictorial", mark: hatch, idea: "A smooth, spotless egg with its first crack: something new is about to start.", why: ["Starter, said as gently as possible", "Spotless shell, clean break", "One oval silhouette, readable at any size"] },
  { slug: "bento", optical: 0.94, name: "Bento", type: "Geometric", mark: bento, idea: "A place for everything, and one compartment left empty for what you generate next.", why: ["Tidy monorepo: apps/ and packages/", "The empty slot is klin generate", "Grid-built, crisp in pixels"] },
  { slug: "bowtie", optical: 1.0, name: "Bowtie", type: "Pictorial", mark: bowtie, idea: "Dressed up and ready to ship; it is also ⋈, the join between front and back.", why: ["Neat, sharp, a little witty", "A hidden data joke for developers", "Wide but solid, unlike any letter"] },
  { slug: "spin", optical: 0.94, name: "Spin", type: "Pictorial", mark: spin, idea: "A washing machine on a clean cycle: put a project in, it comes out spotless.", why: ["The most memorable of the set", "Plays on klin = clean without spelling it", "Friendly, not corporate"] },
  { slug: "sprue", optical: 0.94, name: "Sprue", type: "Pictorial", mark: sprue, idea: "A model-kit frame: every part comes attached and ready to snap out.", why: ["Starter kit, taken literally and lovingly", "Frame, runner and parts make a system", "Fits the website's kit-snapping intro"] },
  { slug: "tangram", optical: 0.94, name: "Tangram", type: "Geometric", mark: tangram, idea: "Seven pieces make one clean square; the last one is sliding home.", why: ["A kit of parts that fits exactly", "The pieces can fly in on the website", "Square footprint for every icon"] },
  { slug: "droplet", name: "Droplet", type: "Wordmark detail", mark: droplet, idea: "The i is dotted with a drop of water; on its own, the drop is the icon, so the name never repeats.", why: ["Removes the mark-plus-word problem entirely", "Fresh water: clean", "The drop doubles as the favicon"] },
  { slug: "weave", optical: 0.98, name: "Weave", type: "Abstract", mark: weave, idea: "Threads woven through three layers, web, API and database: one schema holds the whole stack together.", why: ["klin's core opinion, drawn as cloth", "Woven means well made", "Bars and gaps snap to terminal pixels"] },
]
