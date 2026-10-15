// Phone menu: a disclosure button (aria-expanded) that opens the navigation panel. All links are in the first render.
export function initMenu() {
  const button = document.querySelector(".menu-bouton");
  const nav = document.getElementById("nav");
  if (!button || !nav) return;
  const labelOpen = button.dataset.labelOpen;
  const labelClose = button.dataset.labelClose;

  // While the panel is open it covers the page: everything outside the header is inert (no Tab stop, no pointer) so focus cannot land under it.
  const header = button.closest("header");
  const outside = () => [...document.body.children].filter((el) => el !== header && !["SCRIPT", "STYLE"].includes(el.tagName));

  const set = (open) => {
    outside().forEach((el) => el.toggleAttribute("inert", open));
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? labelClose : labelOpen);
    nav.toggleAttribute("data-open", open);
  };

  button.addEventListener("click", () => set(button.getAttribute("aria-expanded") !== "true"));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || button.getAttribute("aria-expanded") !== "true") return;
    set(false);
    button.focus();
  });

  // A click or tap outside the header closes the panel; focus returns to the button only if it was inside the panel.
  // Focus is read on pointerdown, before the browser moves it to the clicked element.
  let focusInside = false;
  document.addEventListener("pointerdown", () => { focusInside = nav.contains(document.activeElement); }, true);
  document.addEventListener("click", (event) => {
    if (button.getAttribute("aria-expanded") !== "true") return;
    if (header && header.contains(event.target)) return;
    set(false);
    if (focusInside) button.focus();
  });

  // Leaving the menu widths (above 1100px): the desktop nav is always visible, so reset the disclosure.
  matchMedia("(min-width: 1101px)").addEventListener("change", (event) => {
    if (event.matches) set(false);
  });
}
