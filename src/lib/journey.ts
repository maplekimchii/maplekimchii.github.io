// Journey map geometry. Pure functions shared by the build (initial render)
// and the browser (interactive map). World coordinate space: 1280×520.
// The projection matches the one the basemap image was rendered with — don't tweak it.

export type Pt = [number, number];
export type Stop = { lon: number; lat: number };
export type Camera = { s: number; tx: number; ty: number };

export const W = 1280;
export const H = 520;
export const VIS = 456; // projection constant (height of the original overview map)
/** Compact map viewport (Figma 480×196) as a height in world units. */
export const VIEW_H = (W * 196) / 480;
/** Camera zoom: ≈4× the world overview (s = 1.1446), as in the Figma Journey Map / Compact variants. */
export const ZOOM = 4 * 1.1446;

const LAT0 = 72;
const LON0 = -104;
const S = VIS / 92;
const K = 1.0;
const XS = 1.3;
const YH = 62;
const HG = 410;
const CX = 640;
const CURV = 46;
const W0 = 1 / (1 + K);

export function flat(lon: number, lat: number): Pt {
  return [(lon - LON0) * S, (LAT0 - lat) * S];
}

export function proj([fx, fy]: Pt): Pt {
  fy = Math.max(2, fy);
  const v = fy / VIS;
  const w = 1 / (1 + (1 - v) * K);
  const t = (w - W0) / (1 - W0);
  const sx = CX + (fx - CX) * w * XS;
  const sy = YH + t * HG + CURV * ((sx - CX) / CX) ** 2 * (1 - t);
  return [sx, sy];
}

export const project = (s: Stop): Pt => proj(flat(s.lon, s.lat));

const LEG_K = [0.2, -0.15, 0.15, 0.12]; // legs 2–5

/** Quadratic Bézier in flat space for leg i (0-based, from stop i to i+1), sampled and projected. */
export function legSamples(stops: Stop[], i: number, steps = 60): Pt[] {
  const [ax, ay] = flat(stops[i].lon, stops[i].lat);
  const [bx, by] = flat(stops[i + 1].lon, stops[i + 1].lat);
  let c: Pt;
  if (i === 0) c = [(ax + bx) / 2, Math.min(ay, by) - 300];
  else if (i === 5) c = [(ax + bx) / 2, Math.min(ay, by) - 260];
  else {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0) [nx, ny] = [-nx, -ny]; // point the normal up
    const k = LEG_K[i - 1];
    c = [(ax + bx) / 2 + nx * len * k, (ay + by) / 2 + ny * len * k];
  }
  const out: Pt[] = [];
  for (let n = 0; n <= steps; n++) {
    const t = n / steps;
    const u = 1 - t;
    out.push(proj([u * u * ax + 2 * u * t * c[0] + t * t * bx, u * u * ay + 2 * u * t * c[1] + t * t * by]));
  }
  return out;
}

export const pathD = (pts: Pt[]) =>
  pts.map(([x, y], n) => `${n ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Camera centred on `at` at a fixed zoom, clamped so the basemap always fills the viewport. */
export function cameraAt([x, y]: Pt, s = ZOOM, visH = VIEW_H): Camera {
  return { s, tx: clamp(W / 2 - s * x, W - W * s, 0), ty: clamp(visH / 2 - s * y, visH - H * s, 0) };
}

export const toScreen = ([x, y]: Pt, c: Camera): Pt => [c.s * x + c.tx, c.s * y + c.ty];

/** Heading in degrees (0 = nose up) of the segment a→b in screen space. */
export const heading = (a: Pt, b: Pt) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 90;

/** Shortest signed rotation from a to b, in degrees. */
export const shortestDelta = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;
