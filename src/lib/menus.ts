import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AssetRow } from "./assets";

// Verbatim transcriptions of the restaurant menus (03-copy/menus-transcribed.json, read at build time; not a content collection).
// Keyed by page path; the value is one transcription or an array of them. An entry's `image` names the file it transcribes.
export interface MenuSection { heading: string | null; lines: string[] }
export interface Menu { image: string; title: string | null; sections: MenuSection[] }

function findSite(): string {
  let d = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, "03-copy", "menus-transcribed.json"))) return d;
    d = dirname(d);
  }
  throw new Error("menus: 03-copy/menus-transcribed.json not found above " + process.cwd());
}

const DATA = JSON.parse(readFileSync(join(findSite(), "03-copy", "menus-transcribed.json"), "utf8")) as Record<string, Menu | Menu[]>;

/** The page's transcriptions, in file order ([] when it has none). */
export function menusFor(path: string): Menu[] {
  const v = DATA[path];
  return v ? (Array.isArray(v) ? v : [v]) : [];
}

/** File name without folder and extension, lower case. */
export const stemOf = (f: string): string => decodeURIComponent(f.split("?")[0].split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "").toLowerCase();

/** The transcription of the image an asset row was made from (derived_from / original_file / file), or undefined. */
export function menuOfAsset(menus: Menu[], row: AssetRow): Menu | undefined {
  const stems = [row.derived_from, row.original_file, row.file].filter(Boolean).map((x) => stemOf(String(x)));
  return menus.find((m) => stems.includes(stemOf(m.image)));
}

/** Id of the text block of a transcription (unique per image on a page). */
export const menuId = (m: Menu): string => "menu-" + stemOf(m.image).replace(/[^a-z0-9]+/g, "-");
