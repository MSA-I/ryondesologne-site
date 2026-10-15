// Lightbox (DESIGN §11): one <dialog> per page, opened from [data-lightbox-open="<index>"] buttons.
// showModal gives the inert background and Esc; this adds focus return, a Tab trap, arrows, swipe and the cross-fade.
import { reduced } from "./capability.js";

const SWIPE_MIN = 48;

export function initLightbox() {
  const dlg = document.querySelector("dialog.lightbox");
  if (!dlg || dlg.dataset.ready) return;
  dlg.dataset.ready = "1";

  const data = dlg.querySelector('script[type="application/json"]');
  const items = data ? JSON.parse(data.textContent || "[]") : [];
  if (!items.length) return;

  const pic = dlg.querySelector("picture");
  const img = pic.querySelector("img");
  const scene = dlg.querySelector(".lb-scene");
  const counter = dlg.querySelector("[data-lb-i]");
  const prev = dlg.querySelector("[data-lb-prev]");
  const next = dlg.querySelector("[data-lb-next]");
  const close = dlg.querySelector("[data-lb-close]");
  const n = items.length;
  let idx = 0;
  let opener = null;
  let token = 0;
  let moved = false;

  const wrap = (i) => (i + n) % n;
  const fadeMs = () => {
    const q = reduced();
    if (q && q.matches) return 0;
    const v = parseFloat(getComputedStyle(img).transitionDuration);
    return Number.isFinite(v) ? v * 1000 : 0;
  };

  function apply(it) {
    pic.querySelectorAll("source").forEach((s) => s.remove());
    for (const s of it.sources) {
      const el = document.createElement("source");
      el.type = s.type;
      el.srcset = s.srcset;
      el.sizes = it.sizes;
      pic.insertBefore(el, img);
    }
    img.sizes = it.sizes;
    img.width = it.width;
    img.height = it.height;
    img.alt = it.alt;
    img.style.setProperty("--lb-max", it.box + "px");
    img.src = it.src;
  }

  function show(i, instant) {
    idx = wrap(i);
    const it = items[idx];
    const my = ++token;
    counter.textContent = String(idx + 1);
    const ms = instant ? 0 : fadeMs();
    const swap = () => {
      if (my !== token) return;
      const done = () => {
        if (my === token) img.classList.remove("is-out");
      };
      img.onload = done;
      img.onerror = done;
      apply(it);
      if (img.complete) done();
      setTimeout(done, 1500);
    };
    if (!ms) {
      swap();
      return;
    }
    img.classList.add("is-out");
    setTimeout(swap, ms);
  }

  function open(i, trigger) {
    opener = trigger || document.activeElement;
    show(i, true);
    if (!dlg.open) dlg.showModal();
    close.focus();
  }

  dlg.addEventListener("close", () => {
    token++;
    img.classList.remove("is-out");
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  });

  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest("[data-lightbox-open]") : null;
    if (!b) return;
    open(parseInt(b.getAttribute("data-lightbox-open"), 10) || 0, b);
  });

  prev.addEventListener("click", () => show(idx - 1));
  next.addEventListener("click", () => show(idx + 1));
  close.addEventListener("click", () => dlg.close());

  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      show(idx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      show(idx - 1);
    } else if (e.key === "Tab") {
      const f = [close, prev, next].filter((b) => !b.hidden);
      const at = f.indexOf(document.activeElement);
      const to = e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : at === f.length - 1 ? 0 : at + 1;
      e.preventDefault();
      f[to].focus();
    }
  });

  // swipe on the stage (touch-action: pan-y leaves the vertical gesture to the browser)
  let sx = 0;
  let sy = 0;
  scene.addEventListener("pointerdown", (e) => {
    sx = e.clientX;
    sy = e.clientY;
    moved = false;
  });
  scene.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;
    if (e.pointerType === "mouse") return;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) show(idx + (dx < 0 ? 1 : -1));
  });
  // a click on the empty field around the print closes; a swipe's trailing click does not
  dlg.addEventListener("click", (e) => {
    if (moved) {
      moved = false;
      return;
    }
    if (e.target === dlg || e.target === scene) dlg.close();
  });
}
