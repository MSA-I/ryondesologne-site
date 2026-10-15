import "../styles/effects.css";
import { reduced } from "./capability.js";

// Effects reveal + kinetic (DESIGN §6, round FX). Weak phones keep both (LEDGER Mobile:).
// Never on a first-screen element; reduced motion (also when it changes live): shown at once.

const isReduced = () => !!(reduced() && reduced().matches);
const pastFold = (el) => el.getBoundingClientRect().top >= window.innerHeight;

// A clipped element is invisible to IntersectionObserver (its own clip-path counts), so each hidden print is
// watched through an empty absolutely-positioned probe laid over it (page coordinates, kept in sync by a ResizeObserver).
function initReveal() {
  const prints = [...document.querySelectorAll('[data-effect="reveal"]')];
  if (!prints.length) return null;
  const probes = new Map(); // probe -> print
  const place = (probe, el) => {
    const r = el.getBoundingClientRect();
    probe.style.left = `${r.left + window.scrollX}px`;
    probe.style.top = `${r.top + window.scrollY}px`;
    probe.style.width = `${r.width}px`;
    probe.style.height = `${r.height}px`;
  };
  const open = (probe) => {
    probes.get(probe)?.classList.add("est-montre");
    probes.delete(probe);
    io.unobserve(probe);
    probe.remove();
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) open(entry.target);
    },
    { threshold: 0.25 },
  );
  const sync = new ResizeObserver(() => probes.forEach((el, probe) => place(probe, el)));
  if (!isReduced()) {
    for (const el of prints) {
      if (!pastFold(el)) continue;
      const probe = document.createElement("span");
      probe.className = "est-sonde";
      probe.setAttribute("aria-hidden", "true");
      place(probe, el);
      document.body.appendChild(probe);
      el.classList.add("est-cache");
      probes.set(probe, el);
      io.observe(probe);
    }
    sync.observe(document.body);
  }
  return () => {
    // Reduced motion switched on: open everything now (CSS also drops the transition).
    [...probes.keys()].forEach(open);
    io.disconnect();
    sync.disconnect();
  };
}

function words(root) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const re = /\S+/g;
    for (let m = re.exec(node.data); m; m = re.exec(node.data)) {
      const range = document.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      out.push({ text: m[0], rect: range.getClientRects()[0] });
    }
  }
  return out;
}

function initKinetic() {
  const heads = [...document.querySelectorAll('h2[data-effect="kinetic"]')];
  if (!heads.length || isReduced()) return null;
  const states = new Map(); // h2 -> { wrapper, lines }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        play(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.25 },
  );

  function unwrap(h) {
    const st = states.get(h);
    if (!st) return;
    h.querySelector(":scope > .est-lignes")?.remove();
    while (st.wrapper.firstChild) h.insertBefore(st.wrapper.firstChild, st.wrapper);
    st.wrapper.remove();
    h.removeAttribute("data-est-kinetic");
    states.delete(h);
  }

  function play(h) {
    const st = states.get(h);
    if (!st) return;
    h.setAttribute("data-est-kinetic", "in");
    const last = st.lines[st.lines.length - 1];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      unwrap(h); // the heading goes back to plain text once the lines have landed
    };
    last.addEventListener("transitionend", (e) => e.propertyName === "transform" && finish());
  }

  function prepare(h) {
    if (!pastFold(h)) return; // first screen (or already passed): shown at once
    const list = words(h).filter((w) => w.rect);
    if (list.length < 1) return;
    const rows = [];
    let lastTop = null;
    for (const w of list) {
      if (lastTop === null || Math.abs(w.rect.top - lastTop) > w.rect.height / 2) {
        rows.push([]);
        lastTop = w.rect.top;
      }
      rows[rows.length - 1].push(w.text);
    }
    const wrapper = document.createElement("span");
    wrapper.className = "visually-hidden";
    while (h.firstChild) wrapper.appendChild(h.firstChild);
    const clones = document.createElement("span");
    clones.className = "est-lignes";
    clones.setAttribute("aria-hidden", "true");
    const lines = rows.map((row, i) => {
      const line = document.createElement("span");
      line.className = "est-ligne";
      line.style.setProperty("--i", String(i));
      line.textContent = row.join(" ");
      clones.appendChild(line);
      return line;
    });
    h.append(wrapper, clones);
    states.set(h, { wrapper, lines });
    io.observe(h);
  }

  const run = () => heads.forEach(prepare);
  let width = window.innerWidth;
  let timer = 0;
  window.addEventListener(
    "resize",
    () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Rewrap: rebuild the headings that have not played yet.
        for (const [h, st] of [...states]) {
          if (h.getAttribute("data-est-kinetic") === "in") continue;
          io.unobserve(h);
          unwrap(h);
          prepare(h);
        }
      }, 200);
    },
    { passive: true },
  );

  (document.fonts?.ready ?? Promise.resolve()).then(run);

  return () => {
    // Reduced motion switched on: show every pending heading at once.
    io.disconnect();
    for (const h of [...states.keys()]) unwrap(h);
  };
}

export function initEffects() {
  const stops = [initReveal(), initKinetic()].filter(Boolean);
  const mq = reduced();
  if (mq && stops.length) {
    mq.addEventListener("change", (e) => {
      if (e.matches) stops.forEach((stop) => stop());
    });
  }
}
