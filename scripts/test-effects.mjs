// Playwright test for effects reveal + kinetic on a scratch page (no site build needed).
// Run from 06-build: node scripts/test-effects.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || path.join(process.env.USERPROFILE, ".claude/skills/playwright-skill"), "x.js"))("playwright")); }

const TEXT = "Un lieu pour chaque envie de se retrouver autour d'une table longue et joyeuse";
const page_html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/base.css"><link rel="stylesheet" href="/src/styles/effects.css">
<style>h2{font-size:32px;width:300px}.sp{height:2200px}.p{width:248px;height:186px;background:#888}</style></head>
<body><div class="sp"></div><div class="p" id="p" data-effect="reveal"></div><div class="sp"></div>
<h2 id="h" data-effect="kinetic">${TEXT}</h2><div class="sp"></div>
<script type="module">import { initEffects } from "/src/scripts/effects.js"; initEffects();</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/") { res.setHeader("content-type", "text/html"); return res.end(page_html); }
  const file = path.join(root, url);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
  let body = fs.readFileSync(file, "utf8");
  if (url.endsWith(".js")) { body = body.replace(/^import "\.\.\/styles\/effects\.css";/m, ""); res.setHeader("content-type", "text/javascript"); }
  else res.setHeader("content-type", "text/css");
  res.end(body);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${info}`); };
const browser = await chromium.launch();

async function scenario(reducedMotion) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log('console', m.text())); page.on('response', (r) => r.status() >= 400 && console.log('status', r.status(), r.url())); page.on('pageerror', (e) => console.log('pageerror', e.message)); page.on('requestfailed', (r) => console.log('reqfail', r.url()));
  await page.addInitScript(() => {
    window.__tf = [];
    const orig = Element.prototype.animate;
    new MutationObserver(() => {}).observe(document, { childList: true });
    window.__sawTransform = false;
    setInterval(() => {
      for (const el of document.querySelectorAll(".est-ligne")) {
        const t = getComputedStyle(el).transform;
        if (t && t !== "none") window.__sawTransform = true;
      }
    }, 16);
  });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const name = await page.evaluate(() => document.getElementById("h").textContent.replace(/\s+/g, " ").trim());
  await page.evaluate(() => window.scrollTo(0, document.getElementById("p").offsetTop - 200));
  await page.waitForTimeout(900);
  const clip = await page.evaluate(() => getComputedStyle(document.getElementById("p")).clipPath);
  await page.evaluate(() => window.scrollTo(0, document.getElementById("h").offsetTop - 300));
  await page.waitForTimeout(1500);
  const h = page.locator("#h");
  const accName = await page.evaluate(async () => (await 0, document.getElementById("h").innerText.replace(/\s+/g, " ").trim()));
  const snap = await page.accessibility?.snapshot?.().catch(() => null);
  const ariaName = await h.evaluate((el) => el.textContent.replace(/\s+/g, " ").trim());
  const sawTransform = await page.evaluate(() => window.__sawTransform);
  const hidden = await page.evaluate(() => !!document.querySelector(".est-ligne"));
  await ctx.close();
  return { name, clip, accName, ariaName, sawTransform, hidden, snap };
}

const normal = await scenario("no-preference");
check("reveal final clip-path inset(0", normal.clip.startsWith("inset(0"), normal.clip);
check("kinetic H2 innerText equals text after play", normal.accName === TEXT, normal.accName);
check("kinetic transform was applied (motion on)", normal.sawTransform === true);

// accessible name while clones are present: check right after the heading enters
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log('console', m.text())); page.on('response', (r) => r.status() >= 400 && console.log('status', r.status(), r.url())); page.on('pageerror', (e) => console.log('pageerror', e.message)); page.on('requestfailed', (r) => console.log('reqfail', r.url()));
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const h = document.getElementById("h");
    const clones = h.querySelector(".est-lignes");
    const vis = [...h.childNodes].find((n) => n.classList?.contains("visually-hidden"));
    return { lines: h.querySelectorAll(".est-ligne").length, ariaHidden: clones?.getAttribute("aria-hidden"), name: vis?.textContent.replace(/\s+/g, " ").trim() };
  });
  check("kinetic: >=2 aria-hidden line clones over hidden original", info.lines >= 2 && info.ariaHidden === "true" && info.name === TEXT, JSON.stringify(info));
  await ctx.close();
}

const red = await scenario("reduce");
check("reduced: reveal shown (clip inset(0)", red.clip.startsWith("inset(0") || red.clip === "none", red.clip);
check("reduced: H2 name equals text", red.ariaName === TEXT);
check("reduced: no transform ever applied", red.sawTransform === false);
check("reduced: no line clones", red.hidden === false);

await browser.close();
server.close();
process.exit(results.every(Boolean) ? 0 : 1);
