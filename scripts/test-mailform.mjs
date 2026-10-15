// Playwright test for the mail-app form on /contact/contact.html.
// Run from 06-build after a build: node scripts/test-mailform.mjs [distDir]   (default ./dist)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.resolve(root, process.argv[2] || "dist");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || path.join(process.env.USERPROFILE, ".claude/skills/playwright-skill"), "x.js"))("playwright")); }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let file = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", MIME[path.extname(file)] || "application/octet-stream");
  res.end(fs.readFileSync(file));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/contact/contact.html`;

const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${info}`); };
const exe = process.env.PW_CHROMIUM || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

async function open(url, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, ...extra });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.addInitScript(() => {
    window.__handoff = [];
    document.addEventListener("mailform:handoff", (e) => window.__handoff.push(e.detail.url));
  });
  await page.goto(url);
  return page;
}
const form = (p) => p.locator("form[data-mailform=contact]");

// 1. empty submit -> error, alert, aria-invalid, focus on first invalid, no hand-off
let page = await open(base);
await form(page).locator("[data-submit]").click();
check("empty submit: state error", (await form(page).getAttribute("data-state")) === "error");
check("empty submit: one role=alert (form summary), field messages linked by aria-describedby", (await form(page).locator("[role=alert]:not(:empty)").count()) === 1 && (await form(page).locator("[aria-invalid=true][aria-describedby]").count()) === 4 && (await form(page).locator("[data-error]:not(:empty)").count()) === 4);
check("empty submit: aria-invalid on 4 fields", (await form(page).locator("[aria-invalid=true]").count()) === 4);
check("empty submit: focus on first invalid", await page.evaluate(() => document.activeElement?.id) === "mf-contact-name");
check("empty submit: no hand-off", (await page.evaluate(() => window.__handoff.length)) === 0);

// 2. invalid e-mail keeps values
await page.fill("#mf-contact-name", "Test Visiteur");
await page.fill("#mf-contact-email", "pas-un-email");
await page.fill("#mf-contact-sujet", "Réservations Séminaires");
await page.fill("#mf-contact-message", "Bonjour, un message.");
await form(page).locator("[data-submit]").click();
check("bad e-mail: state error, values kept", (await form(page).getAttribute("data-state")) === "error" && (await page.inputValue("#mf-contact-message")) === "Bonjour, un message.");

// 3. valid submit with subject Réservations Séminaires -> mailto:direction..., sent + role=status
await page.fill("#mf-contact-email", "visiteur@example.org");
await form(page).locator("[data-submit]").click();
check("valid submit: state sending, submit aria-disabled", (await form(page).getAttribute("data-state")) === "sending" && (await form(page).locator("[data-submit]").getAttribute("aria-disabled")) === "true");
await page.waitForFunction(() => document.querySelector("form[data-mailform=contact]").dataset.state === "sent", null, { timeout: 4000 });
const urls = await page.evaluate(() => window.__handoff);
check("valid submit: mailto to direction.rayondesologne@gmail.com", urls.length === 1 && urls[0].startsWith("mailto:direction.rayondesologne@gmail.com?"), urls[0] || "");
check("valid submit: subject and body encoded", /subject=R%C3%A9servations%20S%C3%A9minaires/.test(urls[0]) && /body=/.test(urls[0]));
check("sent: role=status with text and mailto link", (await form(page).locator("[role=status] a[href='mailto:direction.rayondesologne@gmail.com']").count()) === 1);
check("sent: submit enabled again", (await form(page).locator("[data-submit]").getAttribute("aria-disabled")) === "false");

// 4. ?sujet= pre-fill (editable) and default routing
page = await open(`${base}?sujet=${encodeURIComponent("Colonies, Classes vertes")}`);
check("?sujet= pre-fills the subject", (await page.inputValue("#mf-contact-sujet")) === "Colonies, Classes vertes");
await page.fill("#mf-contact-name", "A");
await page.fill("#mf-contact-email", "a@example.org");
await page.fill("#mf-contact-message", "m");
await form(page).locator("[data-submit]").click();
await page.waitForFunction(() => document.querySelector("form[data-mailform=contact]").dataset.state === "sent", null, { timeout: 4000 });
check("Colonies subject routes to default (reservations@)", (await page.evaluate(() => window.__handoff[0])).startsWith("mailto:reservationsrayondesologne@gmail.com?"));

await browser.close(); server.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? `test-mailform: ${failed} FAILED` : `test-mailform: ok (${results.length} checks)`);
process.exit(failed ? 1 : 0);
