// T40 content coverage. Usage: node scripts/coverage.mjs <distDir> [--write-omitted]
// Every block of every keep/merge content file (pages, news, newsindex, albums) is
// FOUND (text or approved rewrite on the mapped built page, or site-wide), OMITTED (03-copy/omitted.json) or MISSING.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(here, "..");
const SITE = path.resolve(BUILD, "..");
const dist = path.resolve(process.argv[2] || path.join(BUILD, "dist"));
const ORIGIN = "https://www.rayondesologne.fr";
const rj = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---------- 1. merge omitted fragments
const merged = new Map();
const omDir = path.join(BUILD, "omitted");
const existing = fs.existsSync(path.join(SITE, "03-copy", "omitted.json")) ? rj(path.join(SITE, "03-copy", "omitted.json")) : [];
for (const e of existing) merged.set(`${e.page}#${e.n}`, e);
for (const f of fs.readdirSync(omDir).sort()) {
  if (!f.endsWith(".json")) continue;
  const task = f.replace(/\.json$/, "");
  for (const e of rj(path.join(omDir, f))) {
    const k = `${e.page}#${e.n}`;
    if (merged.has(k)) continue;
    const o = { page: e.page, n: e.n, text: String(e.text ?? "").slice(0, 160), reason: e.reason, task };
    if (e.moved_to) o.moved_to = e.moved_to;
    merged.set(k, o);
  }
}

// ---------- 2. built pages
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const ws = (s) => s.normalize("NFC").replace(/[   ​]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const loose = (s) =>
  ws(s).replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/\s+/g, "");

function htmlParts(html) {
  html = html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const attrs = [];
  html.replace(/\s(?:alt|title|aria-label|placeholder|value|content|label)="([^"]*)"/gi, (_, v) => { attrs.push(decode(v)); return ""; });
  const textSpaced = decode(html.replace(/<[^>]+>/g, " "));
  const textJoined = decode(html.replace(/<[^>]+>/g, ""));
  const nodes = [];
  html.replace(/>([^<]+)</g, (_, t) => { nodes.push(decode(t)); return ""; });
  return { textSpaced, textJoined, attrs, nodes };
}
const pageCache = new Map();
function distFile(newUrl) {
  let p = newUrl.replace(ORIGIN, "");
  if (p.endsWith("/")) p += "index.html";
  return path.join(dist, p);
}
function built(file) {
  if (!pageCache.has(file)) {
    if (!fs.existsSync(file)) { pageCache.set(file, null); }
    else {
      const h = htmlParts(fs.readFileSync(file, "utf8"));
      const all = ws(h.textSpaced + " \n " + h.attrs.join(" \n "));
      const allJ = loose(h.textJoined + h.attrs.join(""));
      pageCache.set(file, { all, allJ });
    }
  }
  return pageCache.get(file);
}
const allHtml = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".html")) allHtml.push(p);
  }
})(dist);
const has = (pg, text) => {
  if (!pg) return 0;
  const t = ws(text);
  if (!t) return 1;
  if (pg.all.includes(t)) return 1;
  if (pg.allJ.includes(loose(text))) return 2; // typographic / spacing difference only
  const t2 = t.replace(/^[-*•]\s*/, "");
  if (t2 !== t && (pg.all.includes(t2) || pg.allJ.includes(loose(t2)))) return 2; // list marker dropped by the build
  return 0;
};

// ---------- 3. maps
const urlRows = fs.readFileSync(path.join(SITE, "url-map.csv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean)
  .map((l) => { const m = l.match(/^([^,]*),([^,]*),([^,]*),/); return { old: m[1], action: m[2], neu: m[3] }; });
const rowByOld = new Map(urlRows.map((r) => [r.old, r]));
const approved = rj(path.join(SITE, "03-copy", "approved.json")).filter((e) => e.original);
// known decisions (orchestrator, T40 brief) added to the merged list
const homeSrc = rj(path.join(SITE, "01-scan", "content", "home.json"));
const rel = (f) => path.relative(dist, f).replace(/\\/g, "/");
const movedTo = (text) => allHtml.filter((f) => has(built(f), text) && rel(f) !== "index.html").map(rel);
const addKnown = (page, n, reason, text, moved_to) => {
  const k = `${page}#${n}`;
  if (merged.has(k)) return;
  const e = { page, n, text: String(text).slice(0, 160), reason, task: "T40" };
  if (moved_to) e.moved_to = moved_to;
  merged.set(k, e);
};
const hb = (n) => homeSrc.blocks.find((b) => b.n === n);
addKnown("home", 20, "Intro line of the old image-link grid; not shown (the build's offer doors carry their own labels)", hb(20).text);
for (const [n, why] of [[13, "Wedding paragraph moved to the wedding page"], [16, "Birthday paragraph moved to the birthday-room page"], [42, "Reviews appeal moved to the contact page"]]) {
  const m = movedTo(hb(n).text);
  if (m.length) addKnown("home", n, why, hb(n).text, m);
}
// draft / backup home pages: duplicates of the home copy (url-map merge into home)
for (const id of ["pages-page-d-accueil-html", "pages-sauvegarde-relooking-page-d-accueil-1-html", "pages-sauvegarde-relooking"]) {
  const src = rj(path.join(SITE, "01-scan", "content", id + ".json"));
  const pg = built(path.join(dist, "index.html"));
  for (const b of src.blocks) {
    if (has(pg, b.text)) continue;
    addKnown(id, b.n, "Draft/backup page merged into home by url-map (not built); duplicate of the home copy or project-phase text", b.text);
  }
}
const omitted = [...merged.values()].sort((a, b) => (a.page < b.page ? -1 : a.page > b.page ? 1 : a.n - b.n));
if (process.argv.includes("--write-omitted")) fs.writeFileSync(path.join(SITE, "03-copy", "omitted.json"), JSON.stringify(omitted, null, 2) + "\n");
const omittedKeys = new Map(omitted.map((e) => [`${e.page}#${e.n}`, e]));

const contentRoot = path.join(BUILD, "src", "content");
const groups = ["pages", "news", "newsindex", "albums"];
const report = { dist, totals: { blocks: 0, FOUND: 0, FOUND_loose: 0, FOUND_sitewide: 0, FOUND_approved: 0, FOUND_WITH_PLACEHOLDER: 0, OMITTED: 0, MISSING: 0 }, pages: [], missing: [], names: {} };
const siteWideCache = (text) => allHtml.some((f) => has(built(f), text));


// open-fact placeholder: the old text has a fragment replaced by [דרוש תוכן: …] in the build
function placeholderMatch(pg, text) {
  const t = ws(text);
  const k = Math.max(6, Math.min(14, Math.floor(t.length / 3)));
  const pre = t.slice(0, k), suf = t.slice(-k);
  let i = pg.all.indexOf(pre);
  while (i >= 0) {
    const win = pg.all.slice(i, i + t.length + 260);
    const ph = win.indexOf("[דרוש תוכן");
    if (ph >= 0 && (win.includes(suf, ph) || /xxxx+[ ]*$/.test(t))) return true;
    i = pg.all.indexOf(pre, i + 1);
  }
  return false;
}
// coordinator rulings (2026-10-14)
const ALT_REASON = "old photo alt/title/file-name text replaced by the round-2b approved alt or the image's own alt; includes private names (not reproduced)";
function coordinatorRuling(id, b, pg) {
  const isAlt = ["a", "@alt", "@title"].includes(b.tag);
  if ((id === "album-photos-mariage" || id === "album-restaurant") && isAlt) return { reason: ALT_REASON };
  if (id === "home" && b.n >= 67 && b.n <= 80 && [67,68,69,70,71,72,78,79,80].includes(b.n) && isAlt) return { reason: ALT_REASON };
  if (id === "contact-contact-html" && [49, 50].includes(b.n)) return { reason: ALT_REASON };
  if (id === "pages-coordonnees-html" && b.n === 48) return { reason: ALT_REASON };
  if (id === "album" && [7, 15].includes(b.n) && b.tag === "span" && /^[0-9]+$/.test(b.text)) return { reason: "old photo counts replaced by the real built counts (Moshe 2026-10-14)" };
  if (id === "home" && b.n === 10) {
    const p = built(path.join(dist, "pages", "presentation.html"));
    if (has(p, b.text)) return { reason: "Intro paragraph moved to the Présentation page", moved_to: ["pages/presentation.html"] };
  }
  return null;
}
const doneIds = new Set();
const byText = new Map();
for (const e of omitted) { const k = ws(e.text); if (k.length >= 3 && e.task !== "T40" && !byText.has(k)) byText.set(k, e); }
const inherited = [];
for (const g of groups) {
  const dir = path.join(contentRoot, g);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    const id = f.replace(/\.json$/, "");
    if (doneIds.has(id)) continue; // album pages sit in pages/ and albums/
    doneIds.add(id);
    const bc = rj(path.join(dir, f));
    const src = rj(path.join(SITE, "01-scan", "content", f));
    const flags = new Map(src.blocks.map((b) => [b.n, b]));
    const row = rowByOld.get(bc.url);
    const target = row ? distFile(row.neu) : null;
    const pg = target ? built(target) : null;
    const rec = { id, group: g, target: target ? path.relative(dist, target).replace(/\\/g, "/") : null, built: !!pg, blocks: 0, FOUND: 0, FOUND_loose: 0, FOUND_sitewide: 0, FOUND_approved: 0, FOUND_WITH_PLACEHOLDER: 0, OMITTED: 0, MISSING: 0 };
    for (const b of src.blocks) {
      rec.blocks++;
      let status = null;
      const om = omittedKeys.get(`${id}#${b.n}`) || omittedKeys.get(`${id === "home" ? "home" : id}#${b.n}`);
      const r = has(pg, b.text);
      if (r === 1) status = "FOUND";
      else if (r === 2) status = "FOUND_loose";
      if (!status) {
        const rw = approved.filter((e) => ws(e.original) === ws(b.text));
        if (rw.some((e) => has(pg, e.approved))) status = "FOUND_approved";
      }
      if (!status && om) status = "OMITTED";
      if (!status && (flags.get(b.n)?.in_nav || flags.get(b.n)?.in_footer) && siteWideCache(b.text)) status = "FOUND_sitewide";
      if (!status && byText.has(ws(b.text))) {
        const src0 = byText.get(ws(b.text));
        inherited.push({ page: id, n: b.n, text: b.text.slice(0, 160), reason: src0.reason + " (same text already omitted on " + src0.page + ")", task: "T40" });
        status = "OMITTED";
      }
      if (!status && pg && placeholderMatch(pg, b.text)) status = "FOUND_WITH_PLACEHOLDER";
      if (!status) {
        const ruled = coordinatorRuling(id, b, pg);
        if (ruled) { inherited.push({ page: id, n: b.n, text: b.text.slice(0, 160), ...ruled, task: "T40" }); status = "OMITTED"; }
      }
      if (!status) status = "MISSING";
      rec[status]++;
      if (status === "MISSING") {
        const elsewhere = siteWideCache(b.text);
        report.missing.push({ page: id, n: b.n, tag: b.tag, text: b.text.slice(0, 80), target: rec.target, onOtherBuiltPage: elsewhere });
      }
    }
    for (const k of Object.keys(report.totals)) if (k !== "blocks") report.totals[k] += rec[k];
    report.totals.blocks += rec.blocks;
    report.pages.push(rec);
  }
}

for (const e of inherited) merged.set(`${e.page}#${e.n}`, e);
const omittedFinal = [...merged.values()].sort((a, b) => (a.page < b.page ? -1 : a.page > b.page ? 1 : a.n - b.n));
if (process.argv.includes("--write-omitted")) fs.writeFileSync(path.join(SITE, "03-copy", "omitted.json"), JSON.stringify(omittedFinal, null, 2) + "\n");
report.inheritedOmitted = inherited.length;

// ---------- 4. private couple names in text nodes (counts only)
const media = fs.readFileSync(path.join(SITE, "01-scan", "media-list.txt"), "utf8");
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pairs = [...new Set([...media.matchAll(/mariage-([a-z0-9-]+?)-et-([a-z0-9-]+)/gi)].map((m) => [m[1], m[2].replace(/\.[a-z0-9]+$/i, "").replace(/-\d+$/, "")]))];
const publicWords = new Set();
for (const f of fs.readdirSync(path.join(SITE, "01-scan", "content"))) for (const w of fold(fs.readFileSync(path.join(SITE, "01-scan", "content", f), "utf8")).match(/[a-z0-9]+/g) || []) publicWords.add(w);
let phraseHits = 0, tokenHits = 0, attrHits = 0;
const tokens = new Set();
for (const [a, b] of pairs) for (const t of [a, b]) for (const w of t.split("-")) if (w.length >= 4 && !/^[0-9]+$/.test(w)) tokens.add(w);
for (const f of allHtml) {
  const h = htmlParts(fs.readFileSync(f, "utf8"));
  const txt = fold(h.nodes.join(" \n "));
  const at = fold(h.attrs.join(" \n "));
  for (const [a, b] of pairs) {
    const ph = `${a.replace(/-/g, " ")} et ${b.replace(/-/g, " ")}`;
    if (txt.includes(ph)) phraseHits++;
    if (at.includes(ph)) attrHits++;
  }
  for (const w of tokens) { if (publicWords.has(w)) continue; if (new RegExp(`\\b${w}\\b`).test(txt)) tokenHits++; }
}
report.names = { pairsInMediaList: pairs.length, pageHits_fullPhrase_textNodes: phraseHits, pageHits_individualName_notInOldSiteText_textNodes: tokenHits, pageHits_fullPhrase_attributes: attrHits };
report.omittedTotal = omittedFinal.length;

fs.writeFileSync(path.join(BUILD, "coverage-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ totals: report.totals, names: report.names, omitted: omittedFinal.length, inherited: inherited.length, missingList: report.missing.length }, null, 1));
