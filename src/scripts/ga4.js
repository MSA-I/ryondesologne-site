// GA4 behind consent. Default denied; the library is injected only after accept.
// The client's own property, carried over (LEDGER Tracking). No new events, no debug_mode.
const GA_ID = "G-4VN4372P6E";
const DENIED = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

function gtag() {
  window.dataLayer.push(arguments);
}

let ready = false;
let injected = false;

/** Consent Mode default, before any library. Safe to call on every page. */
export function ga4Defaults() {
  if (ready) return;
  ready = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || gtag;
  gtag("consent", "default", DENIED);
}

/** Accept: grant analytics, then inject gtag/js once. */
export function ga4Grant() {
  ga4Defaults();
  window["ga-disable-" + GA_ID] = false;
  gtag("consent", "update", { analytics_storage: "granted" });
  if (injected) return;
  injected = true;
  gtag("js", new Date());
  gtag("config", GA_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);
}

/** Reject (or withdraw): deny, and stop the tag if it was loaded. */
export function ga4Deny() {
  ga4Defaults();
  window["ga-disable-" + GA_ID] = true;
  gtag("consent", "update", { analytics_storage: "denied" });
  clearGaCookies();
}

/** Delete _ga and _ga_* on this host and its parent domains, path /. */
function clearGaCookies() {
  const names = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_"));
  if (!names.length) return;
  const parts = location.hostname.split(".");
  const hosts = [""];
  for (let i = 0; i < parts.length - 1; i++) hosts.push("; domain=" + parts.slice(i).join("."));
  for (const n of names) for (const h of hosts) document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + h;
}
