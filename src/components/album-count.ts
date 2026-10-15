import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Real photo count of a built album: assets.json rows with status "produced", role "gallery print…", page "/album/<slug>/".
// Same source the album pages render (the albums collection lists exactly these photos).
function findSite(): string {
  let d = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, "05-assets", "assets.json"))) return d;
    d = dirname(d);
  }
  throw new Error("album-count: 05-assets/assets.json not found above " + process.cwd());
}
const counts = new Map<string, number>();
for (const r of JSON.parse(readFileSync(join(findSite(), "05-assets", "assets.json"), "utf8")) as { status: string; role?: string; page?: string }[]) {
  const m = r.status === "produced" && /^gallery print/.test(r.role ?? "") ? /^\/album\/([^/]+)\/$/.exec(r.page ?? "") : null;
  if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
}

/** albumCount("photos-manoir") -> number of photos on /album/photos-manoir/. Throws on an unknown slug. */
export function albumCount(slug: string): number {
  const n = counts.get(slug);
  if (!n) throw new Error(`album-count: no gallery rows for "${slug}"`);
  return n;
}
