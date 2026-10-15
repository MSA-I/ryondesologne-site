// "Une lumière par usage" (DESIGN §6 secondary move): pointing (mouse), focusing or clicking a use name sets
// data-selected on the section; CSS does the cross-fade, print reveal and line fade (instant under
// prefers-reduced-motion, also when the setting changes live). Phones show the four bands permanently, so the selection is inert there.
export function initUsages(section) {
  if (!section || section.dataset.usagesReady) return;
  section.dataset.usagesReady = "1";
  const names = [...section.querySelectorAll(".nom[data-usage]")];

  // Where all four bands show (<= 760px) the names are not toggles: out of the tab order, no aria-pressed / aria-controls.
  const bands = window.matchMedia("(max-width: 760px)");
  const mode = () => {
    for (const n of names) {
      if (bands.matches) {
        n.setAttribute("tabindex", "-1");
        n.removeAttribute("aria-pressed");
        n.removeAttribute("aria-controls");
      } else {
        n.removeAttribute("tabindex");
        n.setAttribute("aria-pressed", String(n.dataset.usage === section.dataset.selected));
        n.setAttribute("aria-controls", "p-" + n.dataset.usage);
      }
    }
  };

  const select = (use) => {
    if (bands.matches || section.dataset.selected === use) return;
    section.dataset.selected = use;
    for (const n of names) n.setAttribute("aria-pressed", String(n.dataset.usage === use));
  };
  mode();
  bands.addEventListener("change", mode);

  for (const n of names) {
    const use = n.dataset.usage;
    n.addEventListener("click", () => select(use));
    n.addEventListener("focus", () => select(use));
    n.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") select(use);
    });
  }
}

export function initAllUsages(root = document) {
  root.querySelectorAll("section.usages").forEach(initUsages);
}
