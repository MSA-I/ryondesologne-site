import { reduced } from "./capability.js";

// AlbumRows (DESIGN §6 album, ported from board D lines 343-369): the row under the pointer or focus shows its print
// (root.dataset.album + .est-actif on the picture). On a hover device with motion allowed and a width above 760 px the
// print follows the pointer down its own column, eased with --dur-follow, never beyond the root; with focus, touch or
// reduced motion it stays in place. Rows without a print keep the last one.
export function initAlbumRows(root) {
  if (!root || root.dataset.albumRowsReady) return;
  root.dataset.albumRowsReady = "1";
  const pile = root.querySelector(".album-tirages");
  const liste = root.querySelector(".album-liste");
  if (!pile || !liste) return;
  const prints = new Map([...pile.querySelectorAll("[data-album-tirage]")].map((p) => [p.dataset.albumTirage, p]));
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const motionOff = () => !!(reduced() && reduced().matches);
  const tau = () => parseFloat(getComputedStyle(root).getPropertyValue("--dur-follow")) || 110;

  const place = "place" in root.dataset;
  const links = new Map([...liste.querySelectorAll("[data-album-lien]")].map((a) => [a.dataset.albumLien, a]));
  // data-place: the print rests at the height of the row it shows (offset from its natural place, kept inside the section)
  const restY = () => {
    const a = links.get(root.dataset.album);
    if (!place || !a || innerWidth <= 760) return 0;
    const s = root.getBoundingClientRect();
    const p = pile.getBoundingClientRect();
    const r = a.getBoundingClientRect();
    const base = p.top - py;
    const want = r.top + r.height / 2 - p.height / 2 - base;
    return Math.max(s.top + 24 - base, Math.min(s.bottom - 24 - p.height - base, want));
  };

  const show = (key) => {
    const p = prints.get(key);
    if (!p || root.dataset.album === key) return;
    root.dataset.album = key;
    for (const q of prints.values()) q.classList.toggle("est-actif", q === p);
    if (place) aim(restY());
  };

  let py = 0, pyT = 0, raf = 0, prev = 0;
  const set = (v) => { pile.style.transform = Math.abs(v) < 0.5 ? "" : `translateY(${v.toFixed(1)}px)`; };
  const follow = (t) => {
    raf = 0;
    const dt = prev ? Math.min(100, t - prev) : 16;
    prev = t;
    py += (pyT - py) * (1 - Math.exp(-dt / tau()));
    set(py);
    if (Math.abs(pyT - py) > 0.5) raf = requestAnimationFrame(follow);
    else prev = 0;
  };
  const aim = (v) => {
    pyT = v;
    if (motionOff()) { py = v; set(v); return; }
    if (!raf) raf = requestAnimationFrame(follow);
  };

  for (const a of liste.querySelectorAll("[data-album-lien]")) {
    a.addEventListener("focus", () => { show(a.dataset.albumLien); aim(restY()); });
    a.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") show(a.dataset.albumLien); });
  }
  liste.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !fine.matches || motionOff() || innerWidth <= 760) return;
    const s = root.getBoundingClientRect();
    const p = pile.getBoundingClientRect();
    const base = p.top - py;
    const want = e.clientY - p.height / 2 - base;
    aim(Math.max(s.top + 24 - base, Math.min(s.bottom - 24 - p.height - base, want)));
  }, { passive: true });
  liste.addEventListener("pointerleave", () => aim(restY()));
  reduced()?.addEventListener("change", () => { if (motionOff()) { py = restY(); pyT = py; set(py); } });
  if (place) {
    const rest = () => { pyT = py = restY(); set(py); };
    rest();
    addEventListener("load", rest, { once: true });
    document.fonts?.ready.then(rest);
    addEventListener("resize", rest, { passive: true });
  }
}

export function initAllAlbumRows(root = document) {
  root.querySelectorAll(".album-rows").forEach(initAlbumRows);
}
