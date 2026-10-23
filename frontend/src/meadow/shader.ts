// A painted meadow in one fragment shader. Everything is 2D: hills are 1D
// height curves, grass is stacked dash fields, and the whole thing is built
// out of short brush dashes so it reads as oil paint rather than gradients.

export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Wet-paint pointer trail. A small RGBA texture holds, per pixel, the last
// pointer velocity (rg, encoded 0..1) and how wet that spot still is (b).
// Each frame decays it and splats a capsule along the pointer's last move.
export const SPLAT_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uPrev;
uniform vec2  uA;
uniform vec2  uB;
uniform vec2  uVel;
uniform float uAspect;
uniform float uRadius;
uniform float uActive;
uniform float uDecay;

void main() {
  vec4 prev = texture2D(uPrev, vUv);
  vec2 vel = (prev.rg - 0.5) * 2.0 * uDecay;
  float amt = max(0.0, prev.b * uDecay - 0.004);
  if (uActive > 0.5) {
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    vec2 a = vec2(uA.x * uAspect, uA.y);
    vec2 b = vec2(uB.x * uAspect, uB.y);
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float d = length(p - (a + ab * t));
    float sp = exp(-(d * d) / (uRadius * uRadius));
    vel = mix(vel, uVel, sp);
    amt = max(amt, sp);
  }
  gl_FragColor = vec4(vel * 0.5 + 0.5, amt, 1.0);
}
`;

export const FRAG = `
precision highp float;

varying vec2 vUv;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uSun;    // 0..1, y up
uniform vec2  uMoon;   // 0..1, y up
uniform float uNight;  // 0 day .. 1 night
uniform float uDusk;   // 1 when the sun sits on the horizon
uniform float uRain;   // 0 dry .. 1 pouring
uniform float uSeed;
uniform float uKnee;   // portrait: screen y where the horizon sits (0 = off)
uniform sampler2D uFlow;   // wet-paint trail, screen space
uniform float uSunHover;
uniform float uMoonHover;

// In portrait the land would eat most of the screen, so bend screen-y so the
// horizon lands lower. Sky above the knee, land below, both stretched evenly.
float yMap(float y) {
  if (uKnee <= 0.0) return y;
  float H = 0.46;
  return y < uKnee ? y * (H / uKnee) : H + (y - uKnee) * ((1.0 - H) / (1.0 - uKnee));
}

// ---------------------------------------------------------------- noise ----
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float ridge(float x, float s) { return fbm(vec2(x + s, s * 0.37)); }
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - (a + ab * t));
}

// --------------------------------------------------------------- strokes ----
// Short brush dashes laid along 'dir'. Returns 0..1 centred on 0.5: each dash
// is a little lighter or darker than its neighbour, like impasto.
float dashes(vec2 p, vec2 dir, float scale, float s) {
  vec2 o = vec2(-dir.y, dir.x);
  vec2 q = vec2(dot(p, dir) * scale * 0.3, dot(p, o) * scale);
  float row = floor(q.y);
  q.x += hash(vec2(row, s)) * 7.0;              // stagger the rows
  float column = floor(q.x);
  q.y += (hash(vec2(column, s + 5.0)) - 0.5) * 0.7; // and jitter each dash up/down
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(id + s);
  float ragged = (hash(id + s + 3.0) - 0.5) * 0.25;
  float m = smoothstep(0.5, 0.3, abs(f.x) + ragged) * smoothstep(0.5, 0.2, abs(f.y));
  return mix(0.5, h, m);
}
// two layers of dashes so no grid shows
float paint(vec2 p, vec2 dir, float scale, float s) {
  return dashes(p, dir, scale, s) * 0.6 + dashes(p + 0.37, dir, scale * 1.7, s + 11.0) * 0.4;
}
// Anisotropic noise warp for edges: long along dir, short across.
vec2 brush(vec2 p, vec2 dir, float scale, float amp, float s) {
  vec2 ortho = vec2(-dir.y, dir.x);
  vec2 q = vec2(dot(p, dir) * scale * 0.35, dot(p, ortho) * scale * 2.4);
  float n1 = noise(q + s);
  float n2 = noise(q + s + vec2(7.3, 2.1));
  return p + (vec2(n1, n2) - 0.5) * amp;
}

// One depth layer of grass: rows of short tapered blades, each row's blades
// overlapping the row above, like a lawn seen from low down. Only blades whose
// base falls inside [lo, hi] belong to this layer. The caller passes p already
// bent by wind/pointer. Returns (coverage, height along the blade 0..1,
// per-blade random).
vec3 bladeLayer(vec2 p, float colScale, float rowH, float heightMul, float lo, float hi, float s) {
  float r = floor(p.y / rowH);
  vec3 best = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float rr = r - float(k);
    float xr = p.x * colScale + hash(vec2(rr, s + 9.0)) * 0.9;
    float ci = floor(xr);
    vec2 id = vec2(ci, rr);
    float h1 = hash(id + s);
    float h2 = hash(id + s + 1.0);
    float h3 = hash(id + s + 2.0);
    float h4 = hash(id + s + 3.0);
    float base = rr * rowH + h2 * rowH * 0.8;
    float bh = rowH * heightMul * (0.6 + 0.8 * h3);
    float yb = (p.y - base) / bh;
    float fx = fract(xr) - 0.5 + (h1 - 0.5) * 0.35;
    float width = 0.5 * (1.0 - yb * 0.6) * (0.6 + 0.8 * h4);
    float m = smoothstep(width, width - 0.14, abs(fx)) * step(0.0, yb) * smoothstep(1.0, 0.82, yb);
    m *= smoothstep(lo - 0.03, lo, base) * smoothstep(hi + 0.03, hi, base);
    if (m > best.x) best = vec3(m, clamp(yb, 0.0, 1.0), h1);
  }
  return best;
}

float dabsWet(vec2 p, vec2 dir, float s) { return dashes(p, dir, 90.0, s + 4.0); }

// One painted hill layer. h is the ridge height at this column, slope its
// derivative. Colour runs from 'top' at the ridge to 'base' lower down,
// strokes follow the slope, the lit side faces the sun.
vec3 hill(vec2 p, float h, float slope, vec3 top, vec3 base, float lightX, float s, float scale) {
  float down = clamp((h - p.y) * 5.0, 0.0, 1.0);
  vec3 c = mix(top, base, down);
  float lit = 0.5 + 0.5 * clamp(lightX * slope * 30.0, -1.0, 1.0);
  c *= 0.82 + 0.36 * lit;
  vec2 dir = normalize(vec2(1.0, slope * 0.7));
  c *= 1.0 + (paint(p, dir, scale, s) - 0.5) * 0.3;
  return c;
}

void main() {
  float aspect = uRes.x / uRes.y;
  float seed = uSeed;

  // ------------------------------------------------- wet paint under cursor ----
  vec4 flow = texture2D(uFlow, vUv);
  vec2 wetVel = (flow.rg - 0.5) * 2.0;
  float wet = flow.b;
  float speed = length(wetVel);
  vec2 wetDir = wetVel / max(speed, 0.02);
  float wetPush = wet * smoothstep(0.0, 0.25, speed);
  vec2 suv = vUv - wetDir * wetPush * 0.05;
  vec2 uv = vec2(suv.x, yMap(suv.y));
  vec2 p = vec2(uv.x * aspect, uv.y);

  float night = uNight;
  float day = 1.0 - night;
  float rain = uRain;

  vec2 sunP = vec2(uSun.x * aspect, uSun.y);
  vec2 moonP = vec2(uMoon.x * aspect, uMoon.y);
  float sunElev = clamp((uSun.y - 0.38) / 0.5, 0.0, 1.0);
  vec2 toLight = normalize(vec2(sunP.x - p.x, max(sunP.y - 0.45, 0.08) + 0.25));
  float lightX = toLight.x;

  // ----------------------------------------------------------- palette ----
  vec3 skyTopDay   = vec3(0.64, 0.73, 0.81);
  vec3 skyHorDay   = vec3(0.94, 0.91, 0.82);
  vec3 skyTopNight = vec3(0.05, 0.07, 0.17);
  vec3 skyHorNight = vec3(0.12, 0.16, 0.30);
  vec3 duskWarm    = vec3(1.00, 0.64, 0.34);
  vec3 rainTop     = vec3(0.52, 0.56, 0.62);
  vec3 rainHor     = vec3(0.74, 0.74, 0.72);

  vec3 skyTop = mix(mix(skyTopDay, rainTop, rain * 0.8), skyTopNight, night);
  vec3 skyHor = mix(mix(skyHorDay, rainHor, rain * 0.8), skyHorNight, night);
  skyHor = mix(skyHor, duskWarm, uDusk * 0.55 * (1.0 - rain * 0.6));

  // --------------------------------------------------------------- sky ----
  vec2 toSun = p - sunP;
  float dS = length(toSun);
  float ang = atan(toSun.y, toSun.x);
  vec2 tang = normalize(vec2(-toSun.y, toSun.x) + 0.0001);
  float nearSun = smoothstep(0.5, 0.05, dS);

  vec2 ps = brush(p, vec2(1.0, 0.08), 9.0, 0.03, seed);
  float skyT = smoothstep(0.30, 1.0, ps.y);
  vec3 sky = mix(skyHor, skyTop, skyT);

  // clouds: soft masses, heavier in rain
  float cl = fbm(vec2(ps.x * 1.4 + uTime * 0.012, ps.y * 3.2) + seed);
  float cl2 = fbm(vec2(ps.x * 3.6 - uTime * 0.02, ps.y * 7.0) + seed * 2.0);
  float cloud = smoothstep(0.50 - rain * 0.12, 0.72, cl * 0.7 + cl2 * 0.3) * smoothstep(0.42, 0.6, ps.y);
  vec3 cloudCol = mix(vec3(0.98, 0.97, 0.94), vec3(0.11, 0.13, 0.23), night);
  cloudCol = mix(cloudCol, vec3(0.62, 0.64, 0.66), rain * 0.7 * day);
  cloudCol = mix(cloudCol, duskWarm, uDusk * 0.35);
  sky = mix(sky, cloudCol, cloud * 0.7);

  // sky strokes: horizontal dashes that wrap into rings around the sun
  vec2 skyDir = normalize(mix(vec2(1.0, 0.05), tang, nearSun * day));
  float skyPaint = paint(p, skyDir, 170.0, seed);
  sky *= 1.0 + (skyPaint - 0.5) * 0.12;
  sky += (hash(floor(p * 90.0) + seed) - 0.5) * 0.02 * vec3(1.0, 0.85, 0.6);

  // sun glow: a hot white core that fades into warm rings
  float hoverS = 1.0 + 0.35 * uSunHover;
  float swirl = noise(vec2(ang * 4.0 + dS * 6.0, dS * 18.0 - uTime * 0.08) + seed);
  float halo = exp(-dS * 3.4 / hoverS) * (0.75 + 0.5 * swirl);
  float halo2 = exp(-dS * 1.4 / hoverS) * (1.0 + 0.4 * uSunHover);
  vec3 glowCol = mix(vec3(1.0, 0.99, 0.94), duskWarm, uDusk * 0.6);
  float glowAmt = clamp(halo * 0.9 + halo2 * 0.45, 0.0, 1.0) * day * (1.0 - rain * 0.75);
  sky = mix(sky, glowCol, glowAmt);

  // moon glow
  float dM = length(p - moonP);
  float moonUp = smoothstep(0.40, 0.52, uMoon.y);
  float moonAmt = (0.35 + 0.65 * night) * moonUp;
  sky += vec3(0.55, 0.62, 0.78) * exp(-dM * 4.0 / (1.0 + 0.5 * uMoonHover)) * (0.45 + 0.4 * uMoonHover) * night * moonUp;

  // stars, two sizes, twinkling
  float skyMaskY = smoothstep(0.40, 0.58, p.y);
  vec2 sc = floor(p * 140.0);
  float sh = hash(sc + seed);
  vec2 sf = fract(p * 140.0) - 0.5;
  float star = step(0.975, sh) * smoothstep(0.25, 0.0, length(sf));
  star *= 0.55 + 0.45 * sin(uTime * 2.0 + sh * 40.0);
  vec2 sc2 = floor(p * 60.0);
  float sh2 = hash(sc2 + seed + 5.0);
  vec2 sf2 = fract(p * 60.0) - 0.5;
  float star2 = step(0.985, sh2) * smoothstep(0.3, 0.0, length(sf2)) * (0.7 + 0.3 * sin(uTime * 1.3 + sh2 * 50.0));
  sky += vec3(1.0, 0.98, 0.92) * (star * 0.9 + star2 * 1.2) * night * skyMaskY * (1.0 - rain);

  // shooting stars: one every few seconds, a bright head with a fading tail
  {
    float interval = 6.5;
    float k = floor(uTime / interval);
    float t = fract(uTime / interval);
    float dur = 0.13;
    float active = step(t, dur) * step(0.3, hash1(k + 9.0)); // some intervals skip
    float prog = t / dur;
    vec2 start = vec2(0.15 + hash1(k) * (aspect - 0.3), 0.72 + hash1(k + 1.0) * 0.22);
    vec2 dirS = normalize(vec2(mix(-1.0, 1.0, step(0.5, hash1(k + 2.0))), -0.35 - hash1(k + 3.0) * 0.3));
    vec2 head = start + dirS * prog * 0.42;
    vec2 tail = head - dirS * 0.09;
    float d = segDist(p, tail, head);
    float along = clamp(dot(p - tail, head - tail) / dot(head - tail, head - tail), 0.0, 1.0);
    float streak = smoothstep(0.0035, 0.0, d) * along * along * active * (1.0 - prog * 0.6);
    sky += vec3(1.0, 0.97, 0.9) * streak * night * (1.0 - rain);
  }

  // sun and moon discs, same size, brushed edges
  vec2 pd = brush(p, vec2(1.0, 0.3), 30.0, 0.012, seed + 3.0);
  float discR = 0.052;
  float dDisc = length(pd - sunP);
  float sunR = discR * (1.0 + 0.08 * uSunHover);
  float disc = smoothstep(sunR, sunR - 0.006, dDisc);
  float sunPaint = paint(pd - sunP, tang, 300.0, seed + 7.0);
  vec3 sunCol = mix(vec3(0.97, 0.70, 0.14), vec3(1.0, 0.86, 0.40), smoothstep(0.0, sunR, sunR - dDisc) * 0.7 + 0.3 * sunPaint);
  sunCol *= 1.0 + (sunPaint - 0.5) * 0.22;
  sunCol = mix(sunCol, vec3(0.98, 0.5, 0.2), uDusk * 0.5);
  float rim = smoothstep(sunR - 0.012, sunR, dDisc) * disc;
  sunCol = mix(sunCol, vec3(0.93, 0.56, 0.12), rim * 0.8);
  sky = mix(sky, sunCol, disc * day * (1.0 - rain * 0.5));

  float moonR = discR * (1.0 + 0.08 * uMoonHover);
  float dMd = length(pd - moonP);
  float mdisc = smoothstep(moonR, moonR - 0.005, dMd);
  float seas = fbm((pd - moonP) * 28.0 + seed * 5.0);
  float crater = smoothstep(0.55, 0.75, seas);
  vec3 moonCol = mix(vec3(0.96, 0.96, 0.90), vec3(0.72, 0.74, 0.70), crater * 0.8);
  moonCol *= 1.0 + (paint(pd - moonP, vec2(1.0, 0.0), 260.0, seed + 8.0) - 0.5) * 0.25;
  float mrim = smoothstep(moonR - 0.01, moonR, dMd) * mdisc;
  moonCol = mix(moonCol, vec3(0.80, 0.82, 0.78), mrim * 0.6);
  sky = mix(sky, moonCol, mdisc * moonAmt);

  // birds by day: three little painted Vs gliding across
  float land = 0.0;
  vec3 col = sky;
  float birds = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ti = uTime * 0.028 + fi * 0.37;
    float px = fract(ti) * (aspect + 0.3) - 0.15;
    float py = 0.70 + 0.08 * sin(ti * 6.28 * 1.3 + fi) + fi * 0.07;
    vec2 bp = p - vec2(px, py);
    float flap = sin(uTime * 6.0 + fi * 2.1) * 0.45;
    float sz = 0.011 + fi * 0.002;
    float d = min(segDist(bp, vec2(0.0), vec2(-sz, flap * sz)), segDist(bp, vec2(0.0), vec2(sz, flap * sz)));
    birds += smoothstep(0.0024, 0.0010, d);
  }
  col = mix(col, vec3(0.14, 0.14, 0.16), clamp(birds, 0.0, 1.0) * day * (1.0 - rain) * 0.85);

  // ------------------------------------------------------------- hills ----
  vec3 haze = mix(skyHor, skyHorNight, night);
  vec3 nightLand = vec3(0.07, 0.11, 0.14);
  float rainDim = 1.0 - rain * 0.25;

  // far ridge: low on the left, one big dark hill on the right
  vec2 pg = brush(p, vec2(1.0, 0.0), 40.0, 0.006, seed + 11.0);
  float bigHill = smoothstep(0.50, 1.0, uv.x) * (0.9 + 0.3 * ridge(pg.x * 0.8 + 2.0, seed + 5.0));
  float h1 = 0.44 + 0.08 * ridge(pg.x * 1.1, seed + 1.0) + 0.04 * ridge(pg.x * 3.3, seed + 8.0) + 0.26 * bigHill;
  float h1d = (ridge(pg.x * 1.1 + 0.01, seed + 1.0) - ridge(pg.x * 1.1 - 0.01, seed + 1.0)) * 8.0
            + 0.26 * (smoothstep(0.50, 1.0, uv.x + 0.004) - smoothstep(0.50, 1.0, uv.x - 0.004)) * 125.0;
  vec3 farTop = mix(vec3(0.46, 0.58, 0.50), vec3(0.30, 0.44, 0.40), bigHill);
  vec3 farBase = mix(vec3(0.30, 0.44, 0.42), vec3(0.12, 0.25, 0.26), bigHill);
  vec3 far = hill(pg, h1, h1d * 0.1, farTop, farBase, lightX, seed + 1.0, 150.0);
  far = mix(far, haze, (0.5 - 0.38 * bigHill) * day + 0.12 + 0.12 * uDusk);
  far = mix(far, nightLand, night * 0.85);
  float m1 = smoothstep(h1 + 0.005, h1 - 0.005, pg.y + (noise(pg * vec2(80.0, 10.0)) - 0.5) * 0.006);
  col = mix(col, far * rainDim, m1);
  land = max(land, m1);

  // rolling mid hills, taller on the left
  vec2 pm = brush(p, vec2(1.0, 0.15), 40.0, 0.007, seed + 23.0);
  float h2 = 0.37 + 0.12 * ridge(pm.x * 1.5 + 4.0, seed + 2.0) * (1.25 - 0.6 * uv.x);
  float h2d = (ridge(pm.x * 1.5 + 4.01, seed + 2.0) - ridge(pm.x * 1.5 + 3.99, seed + 2.0)) * 60.0 * 0.12;
  vec3 mid = hill(pm, h2, h2d, vec3(0.60, 0.72, 0.42), vec3(0.36, 0.53, 0.30), lightX, seed + 2.0, 190.0);
  mid = mix(mid, haze, 0.22 * day + 0.1 * uDusk);
  mid = mix(mid, nightLand, night * 0.85);
  float m2 = smoothstep(h2 + 0.004, h2 - 0.004, pm.y + (noise(pm * vec2(90.0, 10.0)) - 0.5) * 0.006);
  col = mix(col, mid * rainDim, m2);
  land = max(land, m2);

  // a third, closer band
  vec2 pt = brush(p, vec2(1.0, -0.1), 40.0, 0.006, seed + 29.0);
  float h3 = 0.335 + 0.065 * ridge(pt.x * 2.0 + 7.0, seed + 6.0);
  float h3d = (ridge(pt.x * 2.0 + 7.01, seed + 6.0) - ridge(pt.x * 2.0 + 6.99, seed + 6.0)) * 60.0 * 0.065;
  vec3 third = hill(pt, h3, h3d, vec3(0.68, 0.75, 0.40), vec3(0.46, 0.60, 0.30), lightX, seed + 6.0, 230.0);
  third = mix(third, haze, 0.1 * day);
  third = mix(third, nightLand, night * 0.85);
  float m3 = smoothstep(h3 + 0.004, h3 - 0.004, pt.y + (noise(pt * vec2(100.0, 10.0)) - 0.5) * 0.006);
  col = mix(col, third * rainDim, m3);
  land = max(land, m3);

  // near field, warm yellow-green
  vec2 pn = brush(p, vec2(1.0, 0.0), 40.0, 0.006, seed + 37.0);
  float h4 = 0.305 + 0.045 * ridge(pn.x * 2.3 + 9.0, seed + 3.0);
  float h4d = (ridge(pn.x * 2.3 + 9.01, seed + 3.0) - ridge(pn.x * 2.3 + 8.99, seed + 3.0)) * 60.0 * 0.045;
  vec3 field = hill(pn, h4, h4d, vec3(0.78, 0.80, 0.42), vec3(0.60, 0.70, 0.32), lightX, seed + 3.0, 290.0);
  field = mix(field, nightLand * 1.2, night * 0.85);
  float m4 = smoothstep(h4 + 0.004, h4 - 0.004, pn.y + (noise(pn * vec2(120.0, 10.0)) - 0.5) * 0.006);
  col = mix(col, field * rainDim, m4);
  land = max(land, m4);

  // ------------------------------------------------------------- grass ----
  float gTop = 0.285 + 0.025 * ridge(p.x * 3.0 + 2.0, seed + 4.0);
  float depth = clamp(p.y / max(gTop, 0.01), 0.0, 1.0); // 0 near .. 1 far
  float lift = depth;
  // wind sways the blades; the pointer pushes them over
  float sway = sin(uTime * 0.9 + p.x * 4.0 + seed) * 0.5 + sin(uTime * 1.7 + p.x * 9.0) * 0.25
             + rain * sin(uTime * 3.0 + p.x * 6.0) * 0.4;
  float bend = sway * 0.03 * lift * lift + wetDir.x * wetPush * 0.09 * lift * lift;
  vec2 pgr = vec2(p.x + bend, p.y);
  // blade edge of the meadow against the field
  float edgeN = noise(vec2(pgr.x * 140.0, 3.0) + seed) * 0.5 + noise(vec2(pgr.x * 40.0, 1.0) + seed) * 0.5;
  float inGrass = smoothstep(gTop + 0.012, gTop - 0.012, p.y + (edgeN - 0.5) * 0.045);

  // three depth layers of blades over a mid-green ground, far to near
  vec3 gWarm = vec3(0.80, 0.84, 0.40);
  vec3 gCool = vec3(0.48, 0.70, 0.42);
  vec3 gDark = vec3(0.26, 0.40, 0.15);
  float sunlit = 0.45 + 0.55 * sunElev;
  float clump = fbm(vec2(pgr.x * 4.0, pgr.y * 6.0) + seed * 2.0);
  vec3 grass = mix(vec3(0.30, 0.44, 0.18), vec3(0.52, 0.62, 0.26), depth) * sunlit;
  for (int i = 0; i < 3; i++) {
    float fi = float(i) * 0.5;                 // 0 far .. 1 near
    float colScale = mix(300.0, 85.0, fi);
    float rowH = mix(0.028, 0.07, fi);
    float lo = mix(0.13, -0.08, fi);
    float hi = mix(0.33, 0.10, fi);
    vec3 b = bladeLayer(pgr, colScale, rowH, 2.3, lo, hi, seed + 50.0 + fi * 14.0);
    float hueMix = smoothstep(0.2, 0.8, clump + (b.z - 0.5) * 0.7);
    vec3 tip = mix(gCool, gWarm, hueMix);
    vec3 bc = mix(gDark, tip, 0.5 + 0.5 * b.y) * sunlit;
    bc *= 0.85 + 0.3 * b.z;                   // each blade its own value
    bc = mix(bc, bc * 1.2 + 0.03, smoothstep(0.65, 1.0, b.y) * sunElev); // lit tips
    bc *= mix(1.0, 0.84, fi);                 // nearer blades slightly deeper
    grass = mix(grass, bc, b.x);
  }
  float tuft = smoothstep(0.62, 0.8, fbm(vec2(pgr.x * 14.0, pgr.y * 10.0) + seed));
  grass = mix(grass, grass * 0.7, tuft * 0.6);
  grass = mix(grass, vec3(0.06, 0.11, 0.07), night * 0.88);
  grass *= rainDim;
  col = mix(col, grass, inGrass);

  // flowers: little vertical dashes of colour, denser up close
  vec2 fcell = pgr * vec2(48.0, 26.0);
  vec2 fc = floor(fcell);
  float fh = hash(fc + seed * 7.0);
  vec2 ff = fract(fcell) - 0.5 - (vec2(hash(fc + 1.0), hash(fc + 2.0)) - 0.5) * 0.5;
  float fsize = 1.3 - depth * 0.6;
  float flower = step(0.935, fh) * smoothstep(0.18 * fsize, 0.06 * fsize, abs(ff.x) * 1.1 + abs(ff.y) * 0.5)
               * inGrass * step(0.02, p.y) * (1.0 - depth * 0.85);
  float fk = hash(fc + 2.0);
  vec3 fcol = fk < 0.25 ? vec3(0.98, 0.96, 0.9) : (fk < 0.5 ? vec3(0.78, 0.60, 0.92) : (fk < 0.72 ? vec3(0.96, 0.62, 0.70) : (fk < 0.9 ? vec3(0.98, 0.85, 0.35) : vec3(0.92, 0.45, 0.30))));
  fcol = mix(fcol, fcol * 0.3, night * 0.85);
  col = mix(col, fcol, flower);

  // fireflies at night, drifting and blinking low over the meadow
  {
    vec2 cell = p * vec2(26.0, 30.0);
    vec2 cid = floor(cell);
    float ch = hash(cid + seed * 3.1);
    vec2 cf = fract(cell) - 0.5
            + 0.12 * vec2(sin(uTime * 0.7 + ch * 20.0), cos(uTime * 0.5 + ch * 30.0));
    float blink = smoothstep(0.2, 1.0, sin(uTime * 1.6 + ch * 40.0));
    float fly = step(0.9, ch) * exp(-dot(cf, cf) * 110.0) * blink;
    float low = smoothstep(0.42, 0.25, p.y) * smoothstep(0.02, 0.1, p.y);
    col += vec3(0.85, 1.0, 0.45) * fly * low * night * (1.0 - rain) * 1.2;
  }

  // -------------------------------------------------- dusk + night light ----
  float warm = uDusk * exp(-dS * 1.6) * land * 0.35;
  col += duskWarm * warm * (1.0 - rain);

  // ---------------------------------------------------------------- rain ----
  {
    vec2 rp = vec2(p.x + p.y * 0.22, p.y);
    vec2 rq = vec2(rp.x * 260.0, rp.y * 11.0 + uTime * 3.2);
    vec2 rid = floor(rq);
    vec2 rf = fract(rq);
    float rh = hash(rid + seed);
    float drop = step(0.8 - rain * 0.1, rh) * smoothstep(0.3, 0.12, abs(rf.x - 0.5)) * smoothstep(0.0, 0.3, rf.y) * smoothstep(1.0, 0.5, rf.y);
    vec2 rq2 = vec2(rp.x * 150.0 + 3.0, rp.y * 7.0 + uTime * 2.4);
    vec2 rid2 = floor(rq2);
    vec2 rf2 = fract(rq2);
    float drop2 = step(0.88, hash(rid2 + seed + 2.0)) * smoothstep(0.3, 0.12, abs(rf2.x - 0.5)) * smoothstep(0.0, 0.3, rf2.y) * smoothstep(1.0, 0.5, rf2.y);
    col = mix(col, col * 1.1 + 0.1, (drop * 0.45 + drop2 * 0.35) * rain);
  }

  // --------------------------------------------------------- canvas grain ----
  float grain = noise(p * vec2(220.0, 900.0)) * 0.6 + noise(p * vec2(900.0, 220.0)) * 0.4;
  col *= 0.94 + 0.1 * grain;
  float speck = hash(floor(gl_FragCoord.xy / 2.0));
  col += (speck - 0.5) * 0.03;

  // fresh paint: pushed strokes look thicker and catch the light
  float wetDab = dabsWet(p, wetDir, seed);
  col *= 1.0 + (wetDab - 0.5) * wet * 0.6;
  col = mix(col, col * 1.12 + 0.06, wet * 0.9);

  // soft vignette
  float vig = smoothstep(1.6, 0.3, length((uv - 0.5) * vec2(1.2, 1.0)));
  col *= 0.88 + 0.12 * vig;

  gl_FragColor = vec4(col, 1.0);
}
`;
