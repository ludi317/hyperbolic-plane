// p5.js — The four models of the hyperbolic plane, side by side.
//
//   ┌────────────────────┬────────────────────┐
//   │  Hyperboloid (3D)  │  Poincaré disk     │
//   ├────────────────────┼────────────────────┤
//   │  Klein disk        │  Poincaré half-plane│
//   └────────────────────┴────────────────────┘
//
// One hyperbolic point lives in all four panels at once. Move the cursor in
// any of the three flat panels (disk / Klein / half-plane) and the same point
// traces across the hyperboloid and the other models simultaneously.
//
// Around that point we draw a HYPERBOLIC CIRCLE — the locus of points at a
// fixed hyperbolic distance. Watch how the SAME circle looks in each model:
//   • Hyperboloid : a planar slice of the surface (a true circle in 3D)
//   • Poincaré disk: a Euclidean circle, off-center (model is conformal)
//   • Klein disk   : an ellipse (model is NOT conformal — angles distort)
//   • Half-plane   : a Euclidean circle again (also conformal)
// That is the whole point: every model is the same geometry wearing a
// different disguise.

const W = 820, H = 820;
const CIRCLE_RADIUS = 0.9;   // hyperbolic radius of the traced circle
const TILT = 1.15;           // hyperboloid camera tilt
const HSCALE = 40;           // hyperboloid pixel scale
const ZMAX = 3.2;            // how far up the bowl to draw the wireframe

let panels;
let P = [0, 0, 1];           // current point on the hyperboloid (canonical state)
let GRID;                    // shared hyperbolic grid, built once in canonical coords

function setup() {
  createCanvas(W, H);
  // Four quadrants. Flat panels carry a unit-disk radius R (disk/klein) or a
  // scale S + real-axis y (half-plane).
  const hw = W / 2, hh = H / 2;
  panels = {
    hyper: { x: 0,  y: 0,  w: hw, h: hh, cx: hw / 2,        cy: hh / 2 },
    disk:  { x: hw, y: 0,  w: hw, h: hh, cx: hw + hw / 2,   cy: hh / 2,        R: 150 },
    klein: { x: 0,  y: hh, w: hw, h: hh, cx: hw / 2,        cy: hh + hh / 2,   R: 150 },
    half:  { x: hw, y: hh, w: hw, h: hh, cx: hw + hw / 2,   baseY: H - 70,     S: 120 },
  };
  P = diskToP(0.3, 0.2);
  GRID = buildGrid();
}

// A hyperbolic "Cartesian" grid of GEODESICS that do NOT pass through the
// origin. The trick: a geodesic in the Klein model is just a straight chord,
// so we lay down straight lines u = const and v = const in Klein coordinates,
// then convert each sampled point to the canonical hyperboloid. The result is
// a set of true geodesics — straight in Klein, but circular arcs meeting the
// boundary orthogonally in the Poincaré disk and half-plane.
function buildGrid() {
  const vert = [], horiz = [];
  const cs = [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8];
  const N = 160;
  for (const c of cs) {
    // Geodesic endpoints are ideal points ON the boundary; we stop just shy of
    // it. Note Klein compresses near the rim, so this must be very close to 1
    // to visually reach the Poincaré-disk edge.
    const ext = Math.sqrt(1 - c * c) * 0.99995;
    const vline = [], hline = [];
    for (let i = 0; i <= N; i++) {
      const t = -ext + 2 * ext * i / N;
      vline.push(kleinToP(c, t));               // chord u = c
      hline.push(kleinToP(t, c));               // chord v = c
    }
    vert.push(vline); horiz.push(hline);
  }
  return { vert, horiz };
}

// ---------- complex helpers ----------
function cAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function cSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function cMul(a, b) { return { x: a.x * b.x - a.y * b.y, y: a.x * b.y + a.y * b.x }; }
function cDiv(a, b) { const d = b.x * b.x + b.y * b.y; return { x: (a.x * b.x + a.y * b.y) / d, y: (a.y * b.x - a.x * b.y) / d }; }
const I = { x: 0, y: 1 }, ONE = { x: 1, y: 0 };

// ---------- model conversions (canonical state = hyperboloid point [x,y,z]) ----------
// Hyperboloid: x^2 + y^2 - z^2 = -1, z >= 1.
function diskToP(u, v) { const s = u * u + v * v, d = 1 - s; return [2 * u / d, 2 * v / d, (1 + s) / d]; }
function PToDisk(P) { return [P[0] / (1 + P[2]), P[1] / (1 + P[2])]; }
function kleinToP(u, v) { const s = u * u + v * v, k = 1 / Math.sqrt(1 - s); return [u * k, v * k, k]; }
function PToKlein(P) { return [P[0] / P[2], P[1] / P[2]]; }
function diskToHalf(u, v) { const z = { x: u, y: v }; const w = cDiv(cMul(I, cAdd(ONE, z)), cSub(ONE, z)); return [w.x, w.y]; }
function halfToDisk(a, b) { const w = { x: a, y: b }; const z = cDiv(cSub(w, I), cAdd(w, I)); return [z.x, z.y]; }
function PToHalf(P) { const d = PToDisk(P); return diskToHalf(d[0], d[1]); }
function halfToP(a, b) { const d = halfToDisk(a, b); return diskToP(d[0], d[1]); }

// ---------- Minkowski geometry for the hyperbolic circle ----------
function mink(a, b) { return a[0] * b[0] + a[1] * b[1] - a[2] * b[2]; }
function v3add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function v3scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

// Two Minkowski-orthonormal spacelike tangent vectors at P.
function tangentFrame(P) {
  // v = u + <u,P> P  (projects u onto the tangent space, since <P,P> = -1)
  let v1 = v3add([1, 0, 0], v3scale(P, mink([1, 0, 0], P)));
  let n1 = Math.sqrt(mink(v1, v1));
  if (n1 < 1e-6) { v1 = v3add([0, 1, 0], v3scale(P, mink([0, 1, 0], P))); n1 = Math.sqrt(mink(v1, v1)); }
  const e1 = v3scale(v1, 1 / n1);
  let v2 = v3add([0, 1, 0], v3scale(P, mink([0, 1, 0], P)));
  v2 = v3add(v2, v3scale(e1, -mink(v2, e1)));     // remove e1 component
  const e2 = v3scale(v2, 1 / Math.sqrt(mink(v2, v2)));
  return [e1, e2];
}

// Hyperbolic circle of radius rho about P, as an array of hyperboloid points.
function hyperbolicCircle(P, rho, n) {
  const [e1, e2] = tangentFrame(P);
  const ch = Math.cosh(rho), sh = Math.sinh(rho);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TWO_PI;
    const dir = v3add(v3scale(e1, Math.cos(t)), v3scale(e2, Math.sin(t)));
    pts.push(v3add(v3scale(P, ch), v3scale(dir, sh)));
  }
  return pts;
}

// ---------- screen projections ----------
function diskScreen(pan, u, v) { return [pan.cx + u * pan.R, pan.cy - v * pan.R]; }
function halfScreen(pan, a, b) { return [pan.cx + a * pan.S, pan.baseY - b * pan.S]; }
function hyperScreen(pan, P) {
  const Zr = P[1] * Math.sin(TILT) + P[2] * Math.cos(TILT);
  return [pan.cx + P[0] * HSCALE, pan.cy + 55 - Zr * HSCALE];
}

// ---------- input: which panel is the cursor in? ----------
function inPanel(pan) { return mouseX >= pan.x && mouseX < pan.x + pan.w && mouseY >= pan.y && mouseY < pan.y + pan.h; }
// Invert the hyperboloid's orthographic projection. A vertical screen ray can
// meet the surface twice; we keep the valid root nearest the camera.
function inverseHyper(pan, mx, my) {
  const s = Math.sin(TILT), c = Math.cos(TILT);
  const x = (mx - pan.cx) / HSCALE;
  const A = (pan.cy + 55 - my) / HSCALE;        // = y*sin(TILT) + z*cos(TILT)
  // (c^2 - s^2) y^2 + 2As y + (c^2(1+x^2) - A^2) = 0,  with z = sqrt(1+x^2+y^2)
  const a2 = c * c - s * s, b2 = 2 * A * s, cc = c * c * (1 + x * x) - A * A;
  const D = b2 * b2 - 4 * a2 * cc;
  if (D < 0) return null;
  const sq = Math.sqrt(D);
  let best = null, bestDepth = Infinity;
  for (const y of [(-b2 + sq) / (2 * a2), (-b2 - sq) / (2 * a2)]) {
    const z = Math.sqrt(1 + x * x + y * y);
    if (Math.abs(y * s + z * c - A) > 1e-4) continue;   // wrong sqrt branch
    const depth = y * c - z * s;                          // into-screen distance
    if (depth < bestDepth) { bestDepth = depth; best = [x, y, z]; }
  }
  return best;
}

let active = false;                              // becomes true once the mouse moves
function mouseMoved() { active = true; }
function mouseDragged() { active = true; }

function updatePointFromMouse() {
  if (!active) return;                           // keep the default point until the user interacts
  const d = panels.disk, k = panels.klein, h = panels.half, hy = panels.hyper;
  if (inPanel(hy)) {
    const q = inverseHyper(hy, mouseX, mouseY);
    if (q) P = q;
  } else if (inPanel(d)) {
    let u = (mouseX - d.cx) / d.R, v = -(mouseY - d.cy) / d.R;
    const s = u * u + v * v; if (s >= 0.998) { const f = Math.sqrt(0.998 / s); u *= f; v *= f; }
    P = diskToP(u, v);
  } else if (inPanel(k)) {
    let u = (mouseX - k.cx) / k.R, v = -(mouseY - k.cy) / k.R;
    const s = u * u + v * v; if (s >= 0.998) { const f = Math.sqrt(0.998 / s); u *= f; v *= f; }
    P = kleinToP(u, v);
  } else if (inPanel(h)) {
    const a = (mouseX - h.cx) / h.S; let b = (h.baseY - mouseY) / h.S;
    if (b < 0.02) b = 0.02;
    P = halfToP(a, b);
  }
}

function draw() {
  updatePointFromMouse();
  background(15);

  const circ = hyperbolicCircle(P, CIRCLE_RADIUS, 96);

  // panel separators
  stroke(60); strokeWeight(1);
  line(W / 2, 0, W / 2, H); line(0, H / 2, W, H / 2);

  drawHyperboloid(panels.hyper, P, circ);
  drawDisk(panels.disk, P, circ);
  drawKlein(panels.klein, P, circ);
  drawHalf(panels.half, P, circ);

  drawLabel(panels.hyper, "Hyperboloid model");
  drawLabel(panels.disk, "Poincaré disk  (conformal)");
  drawLabel(panels.klein, "Klein disk  (geodesics straight)");
  drawLabel(panels.half, "Poincaré half-plane  (conformal)");
}

function clipPanel(pan) {
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(pan.x + 1, pan.y + 1, pan.w - 2, pan.h - 2);
  drawingContext.clip();
}

function drawLabel(pan, txt) {
  noStroke(); fill(200); textSize(13); textAlign(LEFT, TOP);
  text(txt, pan.x + 12, pan.y + 10);
}

function styleCircle() { noFill(); stroke(255, 200, 90); strokeWeight(2); }
function stylePoint() { noStroke(); fill(255, 90, 120); }

// Draw the shared grid using a projector proj: [x,y,z] -> [px,py].
// Color is keyed to the index within GRID, which is identical across every
// panel — so a given ring/geodesic wears the SAME color in all four models.
function drawGrid(proj) {
  colorMode(HSB, 360, 100, 100, 100);
  noFill(); strokeWeight(1.3);
  // vertical-chord geodesics: blue -> magenta ramp
  GRID.vert.forEach((line, i) => {
    stroke(map(i, 0, GRID.vert.length - 1, 200, 320), 75, 95, 90);
    beginShape(); for (const Q of line) { const s = proj(Q); vertex(s[0], s[1]); } endShape();
  });
  // horizontal-chord geodesics: green -> yellow ramp
  GRID.horiz.forEach((line, i) => {
    stroke(map(i, 0, GRID.horiz.length - 1, 90, 50), 80, 95, 90);
    beginShape(); for (const Q of line) { const s = proj(Q); vertex(s[0], s[1]); } endShape();
  });
  colorMode(RGB, 255);
}

// Per-panel projectors from canonical [x,y,z] to screen pixels.
function diskProj(pan) { return Q => { const d = PToDisk(Q); return diskScreen(pan, d[0], d[1]); }; }
function kleinProj(pan) { return Q => { const d = PToKlein(Q); return diskScreen(pan, d[0], d[1]); }; }
function halfProj(pan) { return Q => { const d = PToHalf(Q); return halfScreen(pan, d[0], d[1]); }; }
function hyperProj(pan) { return Q => hyperScreen(pan, Q); }

function drawHyperboloid(pan, P, circ) {
  clipPanel(pan);
  const proj = hyperProj(pan);
  drawGrid(proj);
  styleCircle();
  beginShape();
  for (const Q of circ) { const s = proj(Q); vertex(s[0], s[1]); }
  endShape(CLOSE);
  stylePoint(); circle3(proj(P));
  drawingContext.restore();
}

function circle3(s) { circle(s[0], s[1], 9); }

function drawDisk(pan, P, circ) {
  clipPanel(pan);
  const proj = diskProj(pan);
  noFill(); stroke(120); strokeWeight(1.5); circle(pan.cx, pan.cy, pan.R * 2);
  drawGrid(proj);
  styleCircle(); beginShape();
  for (const Q of circ) { const s = proj(Q); vertex(s[0], s[1]); }
  endShape(CLOSE);
  stylePoint(); circle3(proj(P));
  drawingContext.restore();
}

function drawKlein(pan, P, circ) {
  clipPanel(pan);
  const proj = kleinProj(pan);
  noFill(); stroke(120); strokeWeight(1.5); circle(pan.cx, pan.cy, pan.R * 2);
  drawGrid(proj);
  styleCircle(); beginShape();
  for (const Q of circ) { const s = proj(Q); vertex(s[0], s[1]); }
  endShape(CLOSE);
  stylePoint(); circle3(proj(P));
  drawingContext.restore();
}

function drawHalf(pan, P, circ) {
  clipPanel(pan);
  const proj = halfProj(pan);
  stroke(120); strokeWeight(1.5); line(pan.x, pan.baseY, pan.x + pan.w, pan.baseY); // real axis = boundary
  drawGrid(proj);
  styleCircle(); beginShape();
  for (const Q of circ) { const s = proj(Q); vertex(s[0], s[1]); }
  endShape(CLOSE);
  stylePoint(); circle3(proj(P));
  drawingContext.restore();
}
