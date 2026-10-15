// T04 content import. Usage: node scripts/import-content.mjs [--verify]
// Reads 01-scan/content/*.json, url-map.csv, 05-assets/assets.json; writes src/content/**.
// --verify: re-reads the generated files and compares every block text to the source.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(here, "..");
const SITE = path.resolve(BUILD, "..");
const SCAN = path.join(SITE, "01-scan", "content");
const OUT = path.join(BUILD, "src", "content");
const ORIGIN = "https://www.rayondesologne.fr";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const scan = (id) => readJson(path.join(SCAN, id + ".json"));

const pagesIndex = readJson(path.join(SITE, "01-scan", "pages.json")).pages;
const idByUrl = new Map(pagesIndex.map((p) => [p.url, p.id]));
const urlMap = fs
  .readFileSync(path.join(SITE, "url-map.csv"), "utf8")
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((l) => l.split(","));
const keepUrls = urlMap.filter((r) => r[1] === "keep").map((r) => r[0]);

const MERGED = [
  "pages-coordonnees-html",
  "pages-page-html",
  "pages-page-1-html",
  "pages-page-2-html",
  "pages-page-3-html",
  "pages-page-d-accueil-html",
  "pages-sauvegarde-relooking",
  "pages-sauvegarde-relooking-page-d-accueil-1-html",
];
const NEWS_INDEX_PATHS = new Set([
  "/actualites/",
  "/actualites/blog/",
  "/actualites/cuisine/",
  "/actualites/sorties/",
  "/actualites/voyages/",
]);
const pathOf = (u) => u.replace(ORIGIN, "");
const isNewsIndex = (u) => NEWS_INDEX_PATHS.has(pathOf(u));
const isNews = (u) => pathOf(u).startsWith("/actualites/") && !isNewsIndex(u);
const isAlbum = (u) => /^\/album\/[^/]+\/$/.test(pathOf(u));

const blocksOf = (j) =>
  j.blocks.map((b) => {
    const o = { n: b.n, tag: b.tag, text: b.text };
    if (b.href) o.href = b.href;
    return o;
  });

const write = (rel, data) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2) + "\n");
  return f;
};

const assets = readJson(path.join(SITE, "05-assets", "assets.json"));
const produced = assets.filter((a) => a.status === "produced");

function clean() {
  fs.rmSync(path.join(OUT, "facts", "contact.json"), { force: true }); // transcribed.json is hand-kept
  for (const d of ["pages", "news", "newsindex", "albums", "notices"]) {
    fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  }
}

function importAll() {
  clean();
  const counts = { pages: 0, merged: 0, news: 0, newsindex: 0, albums: 0, notices: 0 };

  // pages: keep rows (non-news) + merged
  const pageIds = [];
  for (const u of keepUrls) {
    if (isNews(u) || isNewsIndex(u)) continue;
    const id = idByUrl.get(u);
    if (!id) throw new Error("no scan id for " + u);
    pageIds.push(id);
  }
  counts.pages = pageIds.length;
  for (const id of pageIds) {
    const j = scan(id);
    write(`pages/${id}.json`, { id, url: j.url, blocks: blocksOf(j) });
  }
  for (const id of MERGED) {
    const j = scan(id);
    write(`pages/${id}.json`, { id, url: j.url, blocks: blocksOf(j) });
    counts.merged++;
  }

  // news index pages (category lists): own collection, count of news stays 73
  for (const u of keepUrls.filter(isNewsIndex)) {
    const id = idByUrl.get(u);
    const j = scan(id);
    write(`newsindex/${id}.json`, { id, url: j.url, blocks: blocksOf(j) });
    counts.newsindex++;
  }

  // news
  for (const u of keepUrls.filter(isNews)) {
    const id = idByUrl.get(u);
    const j = scan(id);
    const seg = pathOf(u).split("/");
    const category = seg.length === 4 ? seg[2] : "actualites";
    const blocks = j.blocks;
    const h1 = blocks.find((b) => b.tag === "h1");
    const timeB = blocks.find((b) => b.tag === "time");
    let author = "";
    const par = blocks.findIndex((b) => b.tag === "span" && b.text === "Par");
    if (par >= 0) {
      const a = blocks.slice(par + 1, par + 3).find((b) => b.tag === "a");
      if (a) author = a.text;
    }
    const date = timeB ? timeB.text : "";
    const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(date);
    const base = pathOf(u).split("/").pop();
    const images = produced
      .filter((a) => a.page && a.page.startsWith("/actualites/") && a.page.split("/").pop() === base)
      .map((a) => a.id);
    write(`news/${id}.json`, {
      id,
      url: j.url,
      category,
      title: h1 ? h1.text : "",
      date,
      isoDate: m ? `${m[3]}-${m[2]}-${m[1]}` : "",
      author,
      blocks: blocksOf(j),
      images,
    });
    counts.news++;
  }

  // albums
  for (const u of keepUrls.filter(isAlbum)) {
    const id = idByUrl.get(u);
    const j = scan(id);
    const h1 = j.blocks.find((b) => b.tag === "h1");
    const photos = produced.filter((a) => a.page === pathOf(u)).map((a) => a.id);
    write(`albums/${id}.json`, {
      id,
      name: h1 ? h1.text : id,
      url: j.url,
      count: photos.length,
      photos,
    });
    counts.albums++;
  }

  // notices
  const notices = [
    ["restaurant-winter-closing", "pages-le-restaurant-html", 17],
    ["restaurant-winter-reopening", "pages-le-restaurant-html", 18],
    ["gites-notice-59", "pages-reservations-html", 59],
    ["gites-notice-113", "pages-reservations-html", 113],
    ["gites-notice-114", "pages-reservations-html", 114],
    ["gites-notice-123", "pages-reservations-html", 123],
    ["gites-notice-127", "pages-reservations-html", 127],
  ];
  for (const [id, page, n] of notices) {
    const b = scan(page).blocks.find((x) => x.n === n);
    if (!b) throw new Error(`notice block missing ${page}#${n}`);
    write(`notices/${id}.json`, { id, page, n, text: b.text });
    counts.notices++;
  }

  // facts (scan text; postcode 41230 -> 41320 per LEDGER SEO-local)
  const coord = "pages-coordonnees-html";
  const cont = "contact-contact-html";
  const items = {
    "address-name": { value: "Domaine du Grand Liot", source: { page: coord, n: 9 } },
    "address-street": { value: "2380 C Rte de Romorantin", source: { page: coord, n: 10 } },
    "address-postcode": { value: "41320", scan: "41230", source: { page: coord, n: 10 } },
    "address-city": { value: "Langon-sur-Cher", source: { page: coord, n: 10 } },
    "address-country": { value: "France", source: { page: coord, n: 10 } },
    "phone-restaurant": { value: "02 34 33 11 39", source: { page: coord, n: 11 } },
    "phone-domaine": { value: "06 04 47 54 92", source: { page: coord, n: 12 } },
    "phone-camps": { value: "07 60 03 86 21", source: { page: "pages-infos-legales-mentions-legales-html", n: 8 } },
    "email-gites": { value: "reservationsrayondesologne@gmail.com", source: { page: coord, n: 14 } },
    "email-mariage": { value: "rayondesologne@gmail.com", source: { page: coord, n: 16 } },
    "email-seminaire": { value: "direction.rayondesologne@gmail.com", source: { page: coord, n: 18 } },
    "website-restaurant": { value: "www.bistrotdugrandliot.fr", source: { page: coord, n: 11 } },
  };
  for (const [k, it] of Object.entries(items)) {
    const b = scan(it.source.page).blocks.find((x) => x.n === it.source.n);
    const probe = it.scan ?? it.value;
    if (!b || !b.text.includes(probe)) throw new Error(`fact ${k} not in ${it.source.page}#${it.source.n}`);
    it.tel = /^phone-/.test(k) ? "+33" + it.value.replace(/\s/g, "").slice(1) : undefined;
    if (it.tel === undefined) delete it.tel;
  }
  write("facts/contact.json", { id: "contact", items });

  // approved copy (rewrites keyed by original, labels/meta/alt by where) next to the content
  fs.copyFileSync(path.join(SITE, "03-copy", "approved.json"), path.join(OUT, "approved.json"));

  return counts;
}

function verify() {
  const errs = [];
  const list = (d) =>
    fs.existsSync(path.join(OUT, d)) ? fs.readdirSync(path.join(OUT, d)).filter((f) => f.endsWith(".json")) : [];
  const checkBlocks = (dir, f) => {
    const g = readJson(path.join(OUT, dir, f));
    const s = scan(g.id);
    if (g.blocks.length !== s.blocks.length) errs.push(`${dir}/${f}: block count ${g.blocks.length} != ${s.blocks.length}`);
    for (const b of g.blocks) {
      const sb = s.blocks.find((x) => x.n === b.n);
      if (!sb) errs.push(`${dir}/${f}#${b.n}: not in source`);
      else if (sb.text !== b.text) errs.push(`${dir}/${f}#${b.n}: text differs`);
      else if (sb.tag !== b.tag) errs.push(`${dir}/${f}#${b.n}: tag differs`);
    }
  };
  const pages = list("pages");
  const news = list("news");
  for (const f of pages) checkBlocks("pages", f);
  for (const f of news) checkBlocks("news", f);
  for (const f of list("newsindex")) checkBlocks("newsindex", f);
  // plan says 35 + 7; the merged list (sauvegarde-relooking*) holds 8 ids, so 35 + 8 = 43
  if (pages.length !== 43) errs.push(`pages count ${pages.length} != 43 (35 keep + 8 merged)`);
  if (news.length !== 73) errs.push(`news count ${news.length} != 73`);
  for (const f of list("notices")) {
    const g = readJson(path.join(OUT, "notices", f));
    const b = scan(g.page).blocks.find((x) => x.n === g.n);
    if (!b || b.text !== g.text) errs.push(`notices/${f}: differs`);
  }
  if (!fs.existsSync(path.join(OUT, "approved.json"))) errs.push("approved.json missing");
  console.log(`pages=${pages.length} news=${news.length} newsindex=${list("newsindex").length} albums=${list("albums").length} notices=${list("notices").length}`);
  if (errs.length) {
    console.error(errs.slice(0, 30).join("\n"));
    console.error(`VERIFY FAILED: ${errs.length} problem(s)`);
    process.exit(1);
  }
  console.log("VERIFY OK: every block text identical to source");
}

if (process.argv.includes("--verify")) verify();
else {
  const c = importAll();
  console.log("imported", JSON.stringify(c));
}
