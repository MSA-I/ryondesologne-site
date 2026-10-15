// Consent banner: first visit shows it; choice kept in localStorage "rds-consent".
// "Gestion des cookies" (data-site-studio-consent-open) reopens it.
import { ga4Defaults, ga4Grant, ga4Deny } from "./ga4.js";

const KEY = "rds-consent";

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "accept" || v === "reject" ? v : null;
  } catch {
    return null;
  }
}
function write(v) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage blocked: the choice holds for this page only */
  }
}

export function initConsent() {
  ga4Defaults();
  const banner = document.querySelector("[data-site-studio-consent]");
  const stored = read();
  if (stored === "accept") ga4Grant();
  else if (stored === "reject") ga4Deny();
  if (!banner) return;

  const root = document.documentElement;
  let opener = null;
  const reserve = () => {
    root.style.setProperty("--consent-h", banner.hidden ? "0px" : banner.offsetHeight + "px");
  };
  if ("ResizeObserver" in window) new ResizeObserver(reserve).observe(banner);
  window.addEventListener("resize", reserve, { passive: true });

  const open = (from) => {
    opener = from || null;
    banner.hidden = false;
    reserve();
    if (from) banner.focus({ preventScroll: true });
  };
  const close = () => {
    banner.hidden = true;
    reserve();
    const back = opener && opener.isConnected ? opener : document.getElementById("contenu");
    if (back) back.focus({ preventScroll: true });
    opener = null;
  };

  banner.querySelectorAll("[data-consent]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const accept = btn.dataset.consent === "accept";
      write(accept ? "accept" : "reject");
      if (accept) ga4Grant();
      else ga4Deny();
      close();
    });
  });
  document.querySelectorAll("[data-site-studio-consent-open]").forEach((el) => {
    el.addEventListener("click", () => open(el));
  });

  if (!stored) open(null);
}
