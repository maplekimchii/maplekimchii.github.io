import { test } from 'node:test';
import assert from 'node:assert/strict';
import cities from '../content/cities.json' with { type: 'json' };
import { cameraAt, legSamples, project, toScreen, shortestDelta, H, W, VIEW_H } from './journey.ts';

const legs = cities.slice(0, -1).map((_, i) => legSamples(cities, i));
const near = (a: number, b: number, tol = 1.5) => assert.ok(Math.abs(a - b) <= tol, `${a} !≈ ${b}`);

// Figma Journey Map / Compact is 480px wide: 1 world unit = 480/1280 px.
const px = (p: [number, number]) => [(p[0] * 480) / W, (p[1] * 480) / W];

test('compact camera matches the Figma variants (Step=1 2077:940, Step=4 2077:1141)', () => {
  const c1 = cameraAt(project(cities[0]));
  let [x, y] = px(toScreen(project(cities[0]), c1)); // Seoul pin centre
  near(x, 240, 0.1); near(y, 98, 0.1);
  [x, y] = px(toScreen(project(cities[2]), c1)); // Geneva
  near(x, -575.26, 0.5); near(y, 27.38, 0.5);
  const c4 = cameraAt(project(cities[3]));
  [x, y] = px(toScreen(project(cities[3]), c4)); // Dakar
  near(x, 240, 0.1); near(y, 98, 0.1);
  [x, y] = px(toScreen(project(cities[0]), c4)); // Seoul
  near(x, 1275.31, 0.5); near(y, -38.4, 0.5);
});

test('camera never shows outside the image', () => {
  const pts = [...legs.flat(), [0, 0], [W, H], [W, 0], [0, H]] as [number, number][];
  for (const p of pts) {
    const c = cameraAt(p);
    assert.ok(c.tx <= 0 && c.tx + W * c.s >= W - 1e-9, `x edge at ${p}`);
    assert.ok(c.ty <= 0 && c.ty + H * c.s >= VIEW_H - 1e-9, `y edge at ${p}`);
  }
});

test('every leg ends on its city', () => {
  legs.forEach((pts, i) => {
    const [ax, ay] = project(cities[i]);
    const [bx, by] = project(cities[i + 1]);
    near(pts[0][0], ax, 1e-6); near(pts[0][1], ay, 1e-6);
    near(pts.at(-1)![0], bx, 1e-6); near(pts.at(-1)![1], by, 1e-6);
  });
});

test('shortest rotation', () => {
  assert.equal(shortestDelta(350, 10), 20);
  assert.equal(shortestDelta(10, 350), -20);
  assert.equal(shortestDelta(-170, 170), -20);
});
