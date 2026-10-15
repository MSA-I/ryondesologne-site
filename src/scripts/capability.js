// Capability helpers shared by the motion scripts.
// Weak phone (LEDGER Mobile:): fewer than 4 cores or less than 4 GB, when the browser reports them.
export function isWeak() {
  const cores = navigator.hardwareConcurrency;
  const memory = navigator.deviceMemory;
  return (typeof cores === "number" && cores < 4) || (typeof memory === "number" && memory < 4);
}

const reducedQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

// The live MediaQueryList: read .matches at use time, listen to "change".
export function reduced() {
  return reducedQuery;
}
