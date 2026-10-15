// "La brume se lève" (home opening), ported 1:1 from the approved board D (index.html script, opening part).
// Where the pointer or a finger is, the mist over the pond thins and the pond shows through, then the mist settles back.
// It never thins under text: the clearing is masked out of the measured bands (header, tagline, satellites, the name).
// On arrival the mist lifts once by itself over the water. Decorative field (aria-hidden).
// Quiet (still mist field): prefers-reduced-motion (live) or a weak phone (LEDGER Mobile:): no clearing, no lift.
import { isWeak, reduced } from "./capability.js";

/** Time constants come from the tokens (--dur-*), read once from the hero's computed style. */
function ms(style, name) {
  const raw = style.getPropertyValue(name).trim();   // tokens are written in ms or s
  const v = parseFloat(raw) * (/[\d.]s$/.test(raw) ? 1000 : 1);
  if (!Number.isFinite(v)) throw new Error("brume: missing token " + name);
  return v;
}

/** @param {HTMLElement} hero the .ouverture section */
export function initBrume(hero) {
  const net = hero.querySelector(".eclaircie-net");
  const rond = net && net.querySelector(".eclaircie-rond");
  const fond = net && net.querySelector(".eclaircie-fond");
  const h1 = hero.querySelector("h1");
  if (!net || !rond || !fond || !h1) return;

  const css = getComputedStyle(hero);
  const TRACK = ms(css, "--dur-track");
  const OPEN = ms(css, "--dur-open");
  const CLOSE = ms(css, "--dur-close");
  const SETTLE = ms(css, "--dur-settle");
  const LIFT = ms(css, "--dur-lift");
  const LIFT_DELAY = ms(css, "--dur-lift-delay");

  const reduce = reduced();
  const weak = isWeak();
  const quiet = () => weak || (reduce !== null && reduce.matches);
  const sync = () => { hero.toggleAttribute("data-quiet", quiet()); };
  sync();

  let radius = 0, tx = null, ty = null, x = 0, y = 0, open = 0, target = 0, last = 0, raf = 0, tour = null, prev = 0;

  const stop = () => {
    cancelAnimationFrame(raf); raf = 0; open = 0; target = 0; tour = null; prev = 0;
    net.style.opacity = "0";
  };

  const tick = (t) => {
    raf = 0;
    const dt = prev ? Math.min(100, t - prev) : 16; prev = t;   // time-based easing: the same speed at any frame rate
    const k = (tau) => 1 - Math.exp(-dt / tau);
    if (quiet()) { stop(); return; }
    if (tour) {                                                  // the arrival lift: a slow pass across the water band
      const p = Math.min(1, (t - tour.t0) / tour.d);
      tx = tour.x0 + (tour.x1 - tour.x0) * p; ty = tour.y; target = p < 0.82 ? 1 : 0; last = t;
      if (p >= 1) tour = null;
    } else if (t - last > SETTLE) target = 0;                    // settle back after the pointer rests
    x += (tx - x) * k(TRACK); y += (ty - y) * k(TRACK);
    open += (target - open) * k(target ? OPEN : CLOSE);
    // compositor-only: the disc moves, the photo inside moves back (no mask or filter repaint per frame)
    const ox = x - radius, oy = y - radius;
    rond.style.transform = `translate3d(${ox.toFixed(1)}px,${oy.toFixed(1)}px,0)`;
    fond.style.transform = `translate3d(${(-ox).toFixed(1)}px,${(-oy).toFixed(1)}px,0)`;
    net.style.opacity = open < 0.003 ? "0" : open.toFixed(3);
    if (tour || target || open >= 0.003) raf = requestAnimationFrame(tick); else prev = 0;
  };

  const wake = (e) => {
    if (quiet()) return;
    const r = hero.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < 0 || py < 0 || px > r.width || py > r.height) return;
    tour = null;
    if (tx === null || open < 0.003) { x = px; y = py; }
    tx = px; ty = py; target = 1; last = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  };

  // Text bands, measured on load / resize / fonts: header logo, history link, menu button, nav links, tagline, satellites, the name.
  let band = { haut: 0, bas: 0 };
  const bands = () => {
    const box = hero.getBoundingClientRect(), top = box.top, nom = h1.getBoundingClientRect();
    net.style.setProperty("--hero-w", box.width + "px");
    net.style.setProperty("--hero-h", box.height + "px");
    radius = rond.offsetWidth / 2;
    let navBottom = 0;
    for (const el of document.querySelectorAll(".entete .logo, .entete .histoire, .entete .menu-bouton, .nav a, .titre-sous, .satellites")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) navBottom = Math.max(navBottom, r.bottom - top);
    }
    net.style.setProperty("--nav-bas", Math.round(navBottom + 8) + "px");
    net.style.setProperty("--nom-haut", Math.round(nom.top - top) + "px");
    net.style.setProperty("--nom-bas", Math.round(nom.bottom - top) + "px");
    band = { haut: navBottom + 48, bas: nom.top - top - 56 };
  };
  bands();
  addEventListener("resize", bands, { passive: true });
  document.addEventListener("pointermove", wake, { passive: true });
  document.addEventListener("pointerdown", wake, { passive: true });

  // live preference change
  if (reduce) reduce.addEventListener("change", () => { sync(); if (quiet()) stop(); });

  // The lift waits for the clearing photo to be decoded (a phone on a slow line would otherwise run the whole pass on an empty
  // layer, and the lift would pass unseen); a slow line never blocks it for more than IMG_WAIT.
  const IMG_WAIT = 4000;
  const photo = net.querySelector("img");
  const photoReady = () => {
    if (!photo) return Promise.resolve();
    const decoded = photo.decode ? photo.decode().catch(() => {}) : Promise.resolve();
    return Promise.race([decoded, new Promise((r) => setTimeout(r, IMG_WAIT))]);
  };

  document.fonts.ready.then(() => {
    bands();
    if (quiet()) return;
    // the delay and the photo run side by side: the lift starts when both are done
    Promise.all([photoReady(), new Promise((r) => setTimeout(r, LIFT_DELAY))]).then(() => {
      bands();
      if (quiet() || tx !== null) return;                        // the visitor already moved: no demonstration
      const w = hero.getBoundingClientRect().width, yMid = Math.max(band.haut, (band.haut + band.bas) / 2);
      tour = { t0: performance.now(), d: LIFT, x0: w * 0.18, x1: w * 0.82, y: yMid };
      x = tour.x0; y = yMid;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  });
}
