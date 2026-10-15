// Self-check of the rewrite rule in src/lib/content.ts (node --experimental-strip-types).
// Run: node --experimental-strip-types scripts/check-content.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
const src = fs.readFileSync(new URL("../src/lib/content.ts", import.meta.url), "utf8");
// extract the pure helpers (no import.meta.glob) and evaluate them
const start = src.indexOf("export const rewriteKind");
const end = src.indexOf("const rewrite =");
const js = src.slice(start, end).replace(/: Approved\[\]|: string|: boolean/g, "").replace(/export const/g, "const");
const { rewriteWith } = new Function(js + "; return { rewriteWith };")();

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const list = read("../src/content/approved.json");
const home = read("../src/content/pages/home.json");
const text = (n) => home.blocks.find((b) => b.n === n).text;
const t = (n) => rewriteWith(list, "home", text(n));

assert.equal(t(26), "Restaurant");
for (const [n, id] of [[14, "rw-home-14"], [18, "rw-home-18"]]) {
  const e = list.find((x) => x.proposal === id);
  assert.equal(t(n), e.approved, id);
  assert.notEqual(t(n), text(n));
}
// every approved body/cta rewrite applies on its own page (body:<section> kinds included)
for (const e of list.filter((x) => /^(body|cta)(:|$)/.test(x.where))) assert.equal(rewriteWith(list, e.page, e.original), e.approved, e.proposal);
// a meta-title original never replaces a body block
const meta = list.find((e) => e.where === "meta-title" && e.original);
assert.equal(rewriteWith([meta], meta.page, meta.original), meta.original);
assert.equal(rewriteWith(list, "album-restaurant", "Restaurant"), "Restaurant");
// tr(): transcribed.json entries match sources.json verbatim and are unique
const tj = read("../src/content/facts/transcribed.json").entries;
const srcT = read("../../04-direction/board/D/sources.json").transcribed;
const keys = tj.map((e) => e.key);
assert.equal(new Set(keys).size, keys.length);
const by = Object.fromEntries(tj.filter((e) => e.text).map((e) => [e.key, e.text]));
assert.equal(by["rating-score"], "4,8/5");
assert.equal(by["reviews-thanks"], "Merci pour vos avis 5 étoiles");
assert.equal(by["labels-title"], "Nos labels & engagements");
assert.equal(by["history-link"], "L'HISTOIRE DU LIEU");
for (const u of [...srcT.reviews_banner.used, ...srcT.labels_banner.used]) assert.ok(tj.some((e) => e.text === u), u);
for (const e of tj) assert.ok(e.source && (e.text || e.table), e.key);
const g = tj.find((e) => e.key === "gites-comparison").table;
assert.equal(g.headers.length, 4);
assert.equal(g.rows.length, 5);
for (const r of g.rows) assert.equal(r.length, g.headers.length);
assert.deepEqual(g.rows[4], ["Les Hirondelles", "4 à 8", "Non", "Petits séjours"]);
assert.ok(src.includes("export function trTable("));
assert.equal(by["gites-comparison-title"], "Quel gîte choisir ?");
assert.equal(by["gites-comparison-subtitle"], "Comparez nos hébergements de groupe en Sologne");
assert.ok(src.includes("export function tr(") && src.includes("unknown transcribed key"));
console.log("check-content OK");
