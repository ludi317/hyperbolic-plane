// p5.js — Five views of the hyperbolic plane, side by side.
//
//   ┌────────────────────┬────────────────────┬────────────────────┐
//   │  Hyperboloid (3D)  │  Poincaré disk     │  Klein disk        │
//   ├────────────────────┼────────────────────┼────────────────────┤
//   │ Poincaré half-plane│  Saddle (3D)       │  caption           │
//   └────────────────────┴────────────────────┴────────────────────┘
//
// One hyperbolic point lives in all five panels at once. Move the cursor in
// any panel — the 3D ones included — and the same point traces across the
// other models simultaneously.
//
// Around that point we draw a HYPERBOLIC CIRCLE — the locus of points at a
// fixed hyperbolic distance. Watch how the SAME circle looks in each model:
//   • Hyperboloid : a planar slice of the surface (a true circle in 3D)
//   • Poincaré disk: a Euclidean circle, off-center (model is conformal)
//   • Klein disk   : an ellipse (model is NOT conformal — angles distort)
//   • Half-plane   : a Euclidean circle again (also conformal)
//   • Saddle       : a wavy Pringle-edge loop on a real curved sheet
// That is the whole point: every model is the same geometry wearing a
// different disguise. The white dashed circle in every panel bounds the
// patch of H² that the saddle panel can show.

const W = 1230, H = 820;     // 3 columns x 2 rows of 410px cells
const CIRCLE_RADIUS = 0.9;   // hyperbolic radius of the traced circle
const TILT = 1.15;           // hyperboloid camera tilt
const HSCALE = 40;           // hyperboloid pixel scale
const ZMAX = 3.2;            // how far up the bowl to draw the wireframe
const SDL_RMAX = 1.7;        // hyperbolic radius of the saddle patch
const SDL_SCALE = 80;        // saddle pixel scale
const SDL_TILT = 0.7;        // saddle camera tilt
const SDL_ROT = 0.25;        // initial view rotation about the vertical axis
const SDL_OFF = -38;         // saddle vertical centering offset

let panels;
let P = [0, 0, 1];           // current point on the hyperboloid (canonical state)
let GRID;                    // shared hyperbolic grid, built once in canonical coords
let RIM;                     // saddle patch boundary, in canonical coords

function setup() {
  createCanvas(W, H);
  // Four quadrants. Flat panels carry a unit-disk radius R (disk/klein) or a
  // scale S + real-axis y (half-plane).
  const cw = W / 3, ch = H / 2;                 // cell size
  const cell = (col, row) => ({ x: col * cw, y: row * ch, w: cw, h: ch, cx: col * cw + cw / 2, cy: row * ch + ch / 2 });
  panels = {
    hyper:  { ...cell(0, 0) },
    disk:   { ...cell(1, 0), R: 150 },
    klein:  { ...cell(2, 0), R: 150 },
    half:   { ...cell(0, 1), baseY: H - 70, S: 60 },   // zoomed out so the patch circle fits
    saddle: { ...cell(1, 1) },
  };
  panels.note = cell(2, 1);                     // caption cell (no model)
  P = diskToP(0.3, 0.2);
  GRID = buildGrid();
  buildPatchMarks();
}

// The saddle patch boundary — the hyperbolic circle of radius SDL_RMAX about
// the origin — as a canonical curve every panel can draw.
function buildPatchMarks() {
  RIM = hyperbolicCircle([0, 0, 1], SDL_RMAX, 200);
}

// Dashed overlay of the patch boundary, projected into any model.
function drawPatchMarks(proj) {
  drawingContext.setLineDash([6, 5]);
  noFill();
  stroke(230, 110); strokeWeight(1);
  polyBreak(RIM, proj);
  drawingContext.setLineDash([]);
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
let viewRot = SDL_ROT;                           // saddle view rotation about the vertical axis
function mouseMoved() { active = true; }
function mouseDragged() {
  if (inPanel(panels.saddle)) { viewRot += movedX * 0.012; return; }   // drag = spin, hover = steer
  active = true;
}

function updatePointFromMouse() {
  if (!active) return;                           // keep the default point until the user interacts
  const d = panels.disk, k = panels.klein, h = panels.half, hy = panels.hyper, sd = panels.saddle;
  if (inPanel(hy)) {
    const q = inverseHyper(hy, mouseX, mouseY);
    if (q) P = q;
  } else if (inPanel(sd)) {
    if (!mouseIsPressed) {                       // while dragging, the mouse spins the view instead
      const q = inverseSaddle(sd, mouseX, mouseY);
      if (q) P = q;
    }
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

  // panel separators (3 x 2 grid)
  stroke(60); strokeWeight(1);
  line(W / 3, 0, W / 3, H); line(2 * W / 3, 0, 2 * W / 3, H); line(0, H / 2, W, H / 2);

  drawHyperboloid(panels.hyper, P, circ);
  drawDisk(panels.disk, P, circ);
  drawKlein(panels.klein, P, circ);
  drawHalf(panels.half, P, circ);
  drawSaddle(panels.saddle, P, circ);

  drawLabel(panels.hyper, "Hyperboloid model");
  drawLabel(panels.disk, "Poincaré disk  (conformal)");
  drawLabel(panels.klein, "Klein disk  (geodesics straight)");
  drawLabel(panels.half, "Poincaré half-plane  (conformal)");
  drawLabel(panels.saddle, "Saddle  (curvature −1 at its center)");

  drawNote(panels.note);
}

function drawNote(pan) {
  noStroke(); fill(170); textAlign(LEFT, TOP); textSize(13); textLeading(18);
  text(
    "The SADDLE is the local picture of negative curvature: at every point of " +
    "H² the surface bends up one way and down the other, so circles are longer " +
    "and triangles thinner than in flat space.\n\n" +
    "This saddle is the hyperbolic paraboloid z = (x² − y²)/2. Its curvature " +
    "is exactly −1 at the center but decays away from it — by Hilbert's " +
    "theorem NO smooth surface in 3D keeps curvature −1 everywhere, so a " +
    "saddle can only ever picture a PATCH of H². The white dashed circle " +
    "(hyperbolic radius 1.7 about the origin) marks that patch in every panel.\n\n" +
    "Points land on the saddle by the exponential map: hyperbolic distance and " +
    "direction from the center are kept, so the picture is faithful near the " +
    "middle and increasingly squeezed toward the dashed edge. Watch the yellow " +
    "circle turn into a wavy Pringle-edge curve as it nears the rim.\n\n" +
    "Move the cursor over any panel — the saddle included — to steer the " +
    "shared point. Drag the saddle to spin it.",
    pan.x + 16, pan.y + 44, pan.w - 32, pan.h - 60
  );
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
    polyBreak(line, proj);
  });
  // horizontal-chord geodesics: green -> yellow ramp
  GRID.horiz.forEach((line, i) => {
    stroke(map(i, 0, GRID.horiz.length - 1, 90, 50), 80, 95, 90);
    polyBreak(line, proj);
  });
  colorMode(RGB, 255);
}

// Draw a polyline, breaking it wherever the projector returns null (e.g. the
// point leaves a model's covered patch). Projectors that always return a point
// behave exactly as a plain polyline. Projectors that attach a depth shade in
// slot 2 (the pseudosphere) get per-segment alpha instead.
function polyBreak(line, proj) {
  const pts = line.map(proj);
  if (pts.some(s => s && s.length > 2)) { shadedPoly(pts); return; }
  let pen = false; beginShape();
  for (const s of pts) {
    if (s) { vertex(s[0], s[1]); pen = true; }
    else if (pen) { endShape(); beginShape(); pen = false; }
  }
  endShape();
}

// Segment-by-segment polyline whose alpha is modulated by the depth shade each
// point carries in slot 2. Uses the stroke color/weight already set via p5.
function shadedPoly(pts) {
  const ctx = drawingContext;
  const ga = ctx.globalAlpha;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (!a || !b) continue;
    ctx.globalAlpha = ga * Math.min(a[2], b[2]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.globalAlpha = ga;
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
  drawPatchMarks(proj);
  styleCircle();
  beginShape();
  for (const Q of circ) { const s = proj(Q); vertex(s[0], s[1]); }
  endShape(CLOSE);
  noStroke(); fill(255); circle3(proj(P));      // white dot on the hyperboloid
  drawingContext.restore();
}

function circle3(s) { circle(s[0], s[1], 9); }

function drawDisk(pan, P, circ) {
  clipPanel(pan);
  const proj = diskProj(pan);
  noFill(); stroke(120); strokeWeight(1.5); circle(pan.cx, pan.cy, pan.R * 2);
  drawGrid(proj);
  drawPatchMarks(proj);
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
  drawPatchMarks(proj);
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
  drawPatchMarks(proj);
  styleCircle(); beginShape();
  for (const Q of circ) { const s = proj(Q); vertex(s[0], s[1]); }
  endShape(CLOSE);
  stylePoint(); circle3(proj(P));
  drawingContext.restore();
}

// ---------- saddle ----------
// The local picture of negative curvature: the hyperbolic paraboloid
// z = (x² − y²)/2, whose Gaussian curvature at the origin is exactly −1 (and
// decays away from it — Hilbert's theorem forbids keeping −1 everywhere, so
// no saddle can carry more than a patch of H²). Points of H² land on it via
// the exponential map at the origin: a point at hyperbolic distance ρ in
// direction θ goes to the saddle point above (ρ cos θ, ρ sin θ). Faithful
// near the center, increasingly distorted toward the patch edge.
function sdlTo3D(x, y) { return [x, y, (x * x - y * y) / 2]; }

// Rotate by viewRot about the vertical axis, tilt-project, and attach a depth
// shade in slot 2 (near edge bright, far edge faded) so the sheet reads in 3D.
function sdlScreen(pan, p3) {
  const c = Math.cos(viewRot), s = Math.sin(viewRot);
  const x = p3[0] * c - p3[1] * s, y = p3[0] * s + p3[1] * c, z = p3[2];
  const Zr = y * Math.sin(SDL_TILT) + z * Math.cos(SDL_TILT);
  const d = (y * Math.cos(SDL_TILT) - z * Math.sin(SDL_TILT)) / 2.2;  // into-screen depth
  const shade = 0.3 + 0.7 * Math.min(1, Math.max(0, (1 - d) / 2));
  return [pan.cx + x * SDL_SCALE, pan.cy + SDL_OFF - Zr * SDL_SCALE, shade];
}

// Geodesic polar coordinates (ρ, θ) about the origin of H².
function polarOfP(Q) { return [Math.acosh(Math.max(1, Q[2])), Math.atan2(Q[1], Q[0])]; }

// Invert the saddle's orthographic projection: which (x, y) on z = (x² − y²)/2
// sits under the cursor? Substituting the inverse view rotation into the
// screen equation makes z quadratic in the unknown rotated-y coordinate, so a
// vertical screen ray meets the sheet at up to two points; keep the one
// nearest the camera, lightly clamped to the drawn patch.
function inverseSaddle(pan, mx, my) {
  const c = Math.cos(viewRot), s = Math.sin(viewRot);
  const cT = Math.cos(SDL_TILT), sT = Math.sin(SDL_TILT);
  const xr = (mx - pan.cx) / SDL_SCALE;
  const A = (pan.cy + SDL_OFF - my) / SDL_SCALE;       // = y_r·sin(TILT) + z·cos(TILT)
  // with y_r =: t, the unrotated coords are x = xr·c + t·s, y = −xr·s + t·c
  const qa = cT * (s * s - c * c) / 2;
  const qb = sT + cT * 2 * xr * s * c;
  const qc = cT * xr * xr * (c * c - s * s) / 2 - A;
  let roots;
  if (Math.abs(qa) < 1e-9) {
    if (Math.abs(qb) < 1e-9) return null;
    roots = [-qc / qb];
  } else {
    const D = qb * qb - 4 * qa * qc;
    if (D < 0) return null;
    const sq = Math.sqrt(D);
    roots = [(-qb + sq) / (2 * qa), (-qb - sq) / (2 * qa)];
  }
  let best = null, bestDepth = Infinity;
  for (const t of roots) {
    const x = xr * c + t * s, y = -xr * s + t * c;
    const rho = Math.hypot(x, y);
    if (rho > SDL_RMAX * 1.5) continue;                // hits the sheet far off the patch
    const z = (x * x - y * y) / 2;
    const depth = t * cT - z * sT;                     // into-screen distance
    if (depth < bestDepth) {
      bestDepth = depth;
      const r = Math.min(rho, SDL_RMAX * 0.995), th = Math.atan2(y, x);
      best = [Math.sinh(r) * Math.cos(th), Math.sinh(r) * Math.sin(th), Math.cosh(r)];
    }
  }
  return best;
}

// Projector for the SHARED grid onto the saddle. Returns null outside the
// patch ρ <= SDL_RMAX, so curves break off at the dashed boundary exactly as
// they do in every other panel.
function sdlProj(pan) {
  return Q => {
    const [rho, th] = polarOfP(Q);
    if (rho > SDL_RMAX) return null;
    return sdlScreen(pan, sdlTo3D(rho * Math.cos(th), rho * Math.sin(th)));
  };
}

function drawSaddle(pan, P, circ) {
  clipPanel(pan);
  const shaded = pts3 => shadedPoly(pts3.map(p => sdlScreen(pan, p)));
  // Native polar wireframe, depth-faded so the sheet reads as a solid in 3D.
  noFill(); strokeWeight(1); stroke(110, 110, 120, 110);
  for (let r = 0.4; r < SDL_RMAX - 1e-6; r += 0.4) {
    const ring = [];
    for (let i = 0; i <= 80; i++) { const t = i / 80 * TWO_PI; ring.push(sdlTo3D(r * Math.cos(t), r * Math.sin(t))); }
    shaded(ring);
  }
  for (let k = 0; k < 24; k++) {
    const t = k / 24 * TWO_PI, m = [];
    for (let i = 0; i <= 30; i++) { const r = SDL_RMAX * i / 30; m.push(sdlTo3D(r * Math.cos(t), r * Math.sin(t))); }
    shaded(m);
  }
  // Patch boundary ρ = SDL_RMAX — the same white dashed circle as everywhere.
  stroke(230, 180); strokeWeight(1.5);
  drawingContext.setLineDash([6, 5]);
  beginShape();
  for (let i = 0; i <= 100; i++) {
    const t = i / 100 * TWO_PI;
    const s = sdlScreen(pan, sdlTo3D(SDL_RMAX * Math.cos(t), SDL_RMAX * Math.sin(t)));
    vertex(s[0], s[1]);
  }
  endShape();
  drawingContext.setLineDash([]);
  // The SAME colored grid as every other panel (only the part on the patch).
  drawGrid(sdlProj(pan));
  // hyperbolic circle — only the part inside the patch
  styleCircle();
  polyBreak(circ, sdlProj(pan));
  // the point: solid on the patch (dimmed on the far side), otherwise a hollow
  // ghost on the boundary in the point's direction from the center.
  const [rho, th] = polarOfP(P);
  const r = Math.min(rho, SDL_RMAX);
  const s = sdlScreen(pan, sdlTo3D(r * Math.cos(th), r * Math.sin(th)));
  if (rho <= SDL_RMAX) { noStroke(); fill(255, 90, 120, 255 * s[2]); circle(s[0], s[1], 9); }
  else { noFill(); stroke(255, 90, 120, 200 * s[2]); strokeWeight(1.5); circle(s[0], s[1], 9); }
  noStroke(); fill(120); textSize(11); textAlign(LEFT, TOP);
  text("hover to steer  ·  drag to spin", pan.x + 12, pan.y + 28);
  drawingContext.restore();
}
