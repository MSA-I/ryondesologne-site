// Effect pan: native horizontal scroll-snap rail. JS only adds prev/next (one tile) and ArrowLeft/ArrowRight on the focused track (the scrollable element itself).
// No wheel handler, no autoplay, no scroll jacking: vertical page scroll and Shift+wheel stay native.
export function initPan(root = document) {
  root.querySelectorAll('[data-effect="pan"]').forEach((rail) => {
    if (rail.dataset.panReady) return;
    rail.dataset.panReady = "1";
    const track = rail.querySelector("[data-pan-track]");
    const prev = rail.querySelector("[data-pan-prev]");
    const next = rail.querySelector("[data-pan-next]");
    if (!track) return;

    const tiles = () => Array.from(track.children);
    const dir = () => (getComputedStyle(track).direction === "rtl" ? -1 : 1);
    const step = () => {
      const t = tiles();
      return t.length > 1 ? Math.abs(t[1].offsetLeft - t[0].offsetLeft) : track.clientWidth;
    };
    // behavior "auto" follows the CSS scroll-behavior: smooth, instant under prefers-reduced-motion (also when it changes live).
    const move = (n) => track.scrollBy({ left: n * dir() * step(), behavior: "auto" });

    let frame = 0;
    const sync = () => {
      frame = 0;
      const max = track.scrollWidth - track.clientWidth;
      const pos = Math.abs(track.scrollLeft);
      if (prev) prev.setAttribute("aria-disabled", String(pos <= 1));
      if (next) next.setAttribute("aria-disabled", String(pos >= max - 1));
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(sync); };

    prev?.addEventListener("click", () => { if (prev.getAttribute("aria-disabled") !== "true") move(-1); });
    next?.addEventListener("click", () => { if (next.getAttribute("aria-disabled") !== "true") move(1); });
    track.addEventListener("scroll", queue, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(queue).observe(track);

    rail.addEventListener("keydown", (event) => {
      if (event.target !== rail && event.target !== track) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    });
    sync();
  });
}
