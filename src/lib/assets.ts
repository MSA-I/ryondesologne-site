import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

export interface AssetRow {
  id: string;
  status: string;
  max_css_width?: number;
  files: string[];
  file?: string;
  sha256?: string;
  [k: string]: unknown;
}

export interface ImgOptions {
  box: number;
  sizes: string;
  loading?: "lazy" | "eager";
  fetchpriority?: "high";
  alt?: string;
  /** only for rows with blurred: true (layer shown under a 14-40 px blur): skips the max_css_width and file-size throws, picks the largest file. */
  blurred?: boolean;
}

export interface ImgData {
  sources: { type: string; srcset: string }[];
  src: string;
  width: number;
  height: number;
  alt: string;
  loading: "lazy" | "eager";
  fetchpriority?: "high";
}

/** SITE root = nearest ancestor of cwd holding 05-assets/assets.json (build runs in 06-build). */
function findSite(): string {
  let d = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, "05-assets", "assets.json"))) return d;
    d = dirname(d);
  }
  throw new Error("assets: 05-assets/assets.json not found above " + process.cwd());
}

const SITE = findSite();
const rows = new Map<string, AssetRow>();
for (const r of JSON.parse(readFileSync(join(SITE, "05-assets", "assets.json"), "utf8")) as AssetRow[]) rows.set(r.id, r);

const alts = new Map<string, string>();
for (const a of JSON.parse(readFileSync(join(SITE, "03-copy", "approved.json"), "utf8")) as { where: string; approved: string }[]) {
  if (typeof a.where === "string" && a.where.startsWith("alt:")) alts.set(a.where.slice(4), a.approved);
}

interface Dim { w: number; h: number }
const dims = new Map<string, Dim>();
const all = [...rows.values()].filter((r) => r.status === "produced").flatMap((r) => r.files);
await Promise.all(
  all.map(async (f) => {
    const m = await sharp(join(SITE, f)).metadata();
    dims.set(f, { w: m.width ?? 0, h: m.height ?? 0 });
  }),
);

const MIME: Record<string, string> = { avif: "image/avif", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", svg: "image/svg+xml" };
const ORDER = ["avif", "webp"];

const ext = (f: string) => f.split(".").pop()!.toLowerCase();
/** 05-assets/files/art/x.jpg -> /media/art/x.jpg */
const url = (f: string) => "/media/" + f.replace(/^05-assets\/files\//, "");

/** alt_source usable verbatim as alt: not empty, not "missing…", not a file name. */
function sourceAlt(r: AssetRow): string {
  const a = typeof r.alt_source === "string" ? r.alt_source.trim() : "";
  if (!a || /^missing/i.test(a)) return "";
  if (/\.(jpe?g|png|webp|avif|gif|svg)\b/i.test(a)) return "";
  if (!/\s/.test(a) && /\d{6,}/.test(a)) return "";
  return a;
}

/** Alt order: approved alt:<id>, explicit prop, row alt_source, "". */
export function altOf(id: string, prop?: string): string {
  return alts.get(id) ?? prop ?? sourceAlt(asset(id));
}

export function asset(id: string): AssetRow {
  const r = rows.get(id);
  if (!r) throw new Error(`asset: unknown id "${id}"`);
  if (r.status !== "produced") throw new Error(`asset: "${id}" is ${r.status}, not produced`);
  return r;
}

export function img(id: string, o: ImgOptions): ImgData {
  const r = asset(id);
  let { box } = o;
  const blur = o.blurred === true && r.blurred === true;
  if (!(box > 0)) throw new Error(`img(${id}): box must be > 0`);
  if (!blur && r.max_css_width != null && box > r.max_css_width) throw new Error(`img(${id}): box ${box} > max_css_width ${r.max_css_width}`);
  const files = r.files.map((f) => ({ f, e: ext(f), ...dims.get(f)! }));
  if (blur) box = Math.min(box, Math.max(...files.map((x) => x.w)));
  const fit = files.filter((x) => x.e === "svg" || x.w >= box);
  if (!fit.length) throw new Error(`img(${id}): no file >= box ${box} (largest ${Math.max(...files.map((x) => x.w))})`);

  const sources: ImgData["sources"] = [];
  for (const e of ORDER) {
    const g = fit.filter((x) => x.e === e).sort((a, b) => a.w - b.w);
    if (g.length) sources.push({ type: MIME[e], srcset: g.map((x) => `${url(x.f)} ${x.w}w`).join(", ") });
  }
  const fb = fit.filter((x) => !ORDER.includes(x.e));
  const pool = (fb.length ? fb : fit).sort((a, b) => a.w - b.w);
  const g = pool.filter((x) => x.e === pool[0].e);
  const pick = g[0];
  if (g.length > 1) sources.push({ type: MIME[pick.e], srcset: g.map((x) => `${url(x.f)} ${x.w}w`).join(", ") });
  const alt = altOf(id, o.alt);
  const out: ImgData = { sources, src: url(pick.f), width: pick.w, height: pick.h, alt, loading: o.loading ?? "lazy" };
  if (o.fetchpriority) out.fetchpriority = o.fetchpriority;
  return out;
}
