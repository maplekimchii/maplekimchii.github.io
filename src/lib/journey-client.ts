// Interactive compact journey map. Only the slider changes stops, forward one at a
// time (tap the next stop code, Right/Up, Enter, Space); the map itself has no pointer handlers, so it never blocks
// page scrolling. The camera stays at a fixed zoom and follows the plane.
import {
  VIEW_H, W, cameraAt, heading, legSamples, project, shortestDelta, toScreen,
  type Camera, type Pt,
} from './journey';

type City = { code: string; city: string; km: number; lon: number; lat: number };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpCam = (a: Camera, b: Camera, t: number): Camera => ({
  s: lerp(a.s, b.s, t), tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t),
});

export function initJourney(root: HTMLElement) {
  const cities: City[] = JSON.parse(root.dataset.journey!);
  const last = cities.length;
  const total = cities[last - 1].km;
  const legs = cities.slice(0, -1).map((_, i) => legSamples(cities, i));
  const world = root.querySelector<HTMLElement>('.world')!;
  const plane = root.querySelector<HTMLElement>('.plane')!;
  const pins = [...root.querySelectorAll<HTMLElement>('[data-pin]')];
  const labels = [...root.querySelectorAll<HTMLElement>('[data-label]')];
  const paths = [...root.querySelectorAll<SVGPathElement>('[data-leg]')];
  const track = root.querySelector<HTMLElement>('.track')!;
  const progress = root.querySelector<HTMLElement>('.progress')!;
  const stops = [...root.querySelectorAll<HTMLElement>('[data-stop]')];
  const thumb = root.querySelector<HTMLElement>('.thumb')!;
  const live = root.querySelector<HTMLElement>('[data-live]')!;
  const stage = root.querySelector<HTMLElement>('.stage')!;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const camAt = (k: number) => cameraAt(project(cities[k - 1]));
  const restAngle = (k: number) =>
    k === 1 ? heading(legs[0][0], legs[0][1]) : heading(legs[k - 2].at(-2)!, legs[k - 2].at(-1)!);
  // Earlier legs 55%, the leg just flown 100%, future legs hidden.
  const legOpacity = (k: number, i: number) => (i < k - 2 ? 0.55 : i === k - 2 ? 1 : 0);
  const pct = (km: number) => (km / total) * 100;
  const valueText = (k: number) => `${cities[k - 1].city}, ${cities[k - 1].km.toLocaleString('en-CA')} km`;

  let step = 1;
  let anim = 0;
  let planeAngle = restAngle(step);

  function place(el: HTMLElement, [x, y]: Pt) {
    el.style.left = `${(x / W) * 100}%`;
    el.style.top = `${(y / VIEW_H) * 100}%`;
  }

  function drawFrame(c: Camera, planeAt: Pt, angle: number) {
    world.style.transform = `translate(${(c.tx / W) * 100}%, ${(c.ty / 520) * 100}%) scale(${c.s})`;
    cities.forEach((city, i) => {
      const p = toScreen(project(city), c);
      place(pins[i], p);
      place(labels[i], p);
    });
    place(plane, toScreen(planeAt, c));
    plane.style.setProperty('--rot', `${angle}deg`);
  }

  function setMarkers(k: number) {
    cities.forEach((_, i) => {
      pins[i].classList.toggle('current', i === k - 1);
      labels[i].classList.toggle('current', i === k - 1);
      stops[i].classList.toggle('reached', i < k - 1);
      stops[i].classList.toggle('current', i === k - 1);
    });
  }

  function setSlider(km: number) {
    thumb.style.left = `${pct(km)}%`;
    progress.style.width = `${pct(km)}%`;
  }

  function renderStatic(k: number) {
    planeAngle = restAngle(k);
    drawFrame(camAt(k), project(cities[k - 1]), planeAngle);
    paths.forEach((p, i) => (p.style.opacity = String(legOpacity(k, i))));
    setMarkers(k);
    setSlider(cities[k - 1].km);
  }

  function goTo(target: number, { replay = false } = {}) {
    target = Math.max(1, Math.min(last, target));
    if (anim) {
      cancelAnimationFrame(anim);
      anim = 0;
      plane.style.opacity = '';
      renderStatic(step);
    }
    if (target === step) return;
    const from = step;
    step = target;
    live.textContent = `${valueText(target)} flown`;
    track.setAttribute('aria-valuenow', String(target));
    track.setAttribute('aria-valuetext', valueText(target));

    if (reduced.matches) {
      renderStatic(target);
      stage.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      return;
    }

    // Plane route: the legs between the two stops (reversed when going back).
    const forward = target > from;
    let route: Pt[] = [];
    if (!replay) {
      const [a, b] = forward ? [from - 1, target - 2] : [target - 1, from - 2];
      for (let i = a; i <= b; i++) route = route.concat(i === a ? legs[i] : legs[i].slice(1));
      if (!forward) route.reverse();
    }

    const c0 = camAt(from);
    const c1 = camAt(target);
    const o0 = paths.map((_, i) => legOpacity(from, i));
    const o1 = paths.map((_, i) => legOpacity(target, i));
    const km0 = cities[from - 1].km;
    const km1 = cities[target - 1].km;
    const angle0 = planeAngle;
    const hops = Math.abs(target - from);
    const duration = replay ? 1400 : Math.min(3200, 1500 + 350 * (hops - 1));

    // Leaving: the origin becomes a plain white stop; the target lights up on arrival.
    setMarkers(0);
    for (let i = 0; i < Math.min(from, target) - 1; i++) stops[i].classList.add('reached');

    const t0 = performance.now();
    const tick = (now: number) => {
      const raw = Math.min(1, (now - t0) / duration);
      const t = ease(raw);

      let at: Pt;
      let angle: number;
      let c: Camera;
      if (replay) {
        // Pan back to the start at constant zoom while the plane fades out and in.
        c = lerpCam(c0, c1, t);
        at = project(raw < 0.5 ? cities[from - 1] : cities[target - 1]);
        angle = raw < 0.5 ? angle0 : restAngle(target);
        plane.style.opacity = String(Math.abs(1 - raw * 2));
      } else {
        const f = t * (route.length - 1);
        const n = Math.min(route.length - 2, Math.floor(f));
        const u = f - n;
        at = [lerp(route[n][0], route[n + 1][0], u), lerp(route[n][1], route[n + 1][1], u)];
        // Camera follows the plane at a constant zoom; it starts and ends centred on a city.
        c = cameraAt(at);
        // Heading follows the route; ease in from the previous heading by the shortest turn.
        const pathAngle = heading(route[n], route[n + 1]);
        angle = angle0 + shortestDelta(angle0, pathAngle) * Math.min(1, raw / 0.2);
      }
      drawFrame(c, at, angle);
      paths.forEach((p, i) => (p.style.opacity = String(lerp(o0[i], o1[i], t))));
      setSlider(lerp(km0, km1, t));

      if (raw < 1) {
        anim = requestAnimationFrame(tick);
      } else {
        anim = 0;
        plane.style.opacity = '';
        renderStatic(target);
      }
    };
    anim = requestAnimationFrame(tick);
  }

  // ---- Slider input: forward one stop at a time only ----
  // A tap on the next stop's code (or SEL once at YYZ, which replays) moves on; Right/Up,
  // Enter and Space do the same. Everything else, and any input mid-flight, is ignored.
  const nearestStop = (clientX: number) => {
    const r = track.getBoundingClientRect();
    const km = ((clientX - r.left) / r.width) * total;
    let best = 0;
    cities.forEach((c, i) => {
      if (Math.abs(c.km - km) < Math.abs(cities[best].km - km)) best = i;
    });
    return best + 1;
  };
  const next = () => (step === last ? 1 : step + 1);
  const advance = () => {
    if (anim) return;
    if (step === last) goTo(1, { replay: true });
    else goTo(step + 1);
  };

  track.addEventListener('click', (e) => {
    if (nearestStop(e.clientX) === next()) advance();
  });
  track.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      advance();
    } else if (['ArrowLeft', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      e.preventDefault(); // a slider would normally move on these; this one only goes forward
    }
  });

  renderStatic(step);
}
