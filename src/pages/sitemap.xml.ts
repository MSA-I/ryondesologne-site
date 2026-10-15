// sitemap.xml: exactly the indexable pages the build emits (every route except the 404 page; no redirects).
// Static routes come from the page files, dynamic ones from the collections their getStaticPaths read.
// No <lastmod>/<priority>/<changefreq>: the scan holds no reliable last-change dates.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const ORIGIN = "https://www.rayondesologne.fr";
const CATEGORIES = ["blog", "cuisine", "sorties", "voyages"]; // src/pages/actualites/[cat]/index.astro

const staticRoutes = Object.keys(import.meta.glob("./**/*.astro"))
  .map((f) => f.replace(/^\.\//, "").replace(/\.astro$/, ""))
  .filter((f) => !f.includes("[") && f !== "404")
  .map((f) => (f === "index" ? "/" : f.endsWith("/index") ? `/${f.slice(0, -"index".length)}` : `/${f}.html`));

export const GET: APIRoute = async () => {
  const news = (await getCollection("news")).map((e) => new URL(e.data.url).pathname);
  const albums = (await getCollection("albums")).map((e) => new URL(e.data.url).pathname);
  const cats = CATEGORIES.map((c) => `/actualites/${c}/`);
  const paths = [...new Set([...staticRoutes, ...cats, ...albums, ...news])].sort();
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths.map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
