import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Editable-field schemas (LEDGER Content-route: structured content separate from design).
// The embeds collection (planner snippets) belongs to T12, which adds it with Edit.

const block = z.object({
  n: z.number().int(),
  tag: z.string(),
  text: z.string(),
  href: z.string().optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/pages" }),
  schema: z.object({ id: z.string(), url: z.string().url(), blocks: z.array(block) }),
});

const newsindex = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/newsindex" }),
  schema: z.object({ id: z.string(), url: z.string().url(), blocks: z.array(block) }),
});

const news = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/news" }),
  schema: z.object({
    id: z.string(),
    url: z.string().url(),
    category: z.enum(["actualites", "blog", "cuisine", "sorties", "voyages"]),
    title: z.string(),
    date: z.string(), // verbatim from the old page, e.g. "Le 08/09/2023"
    isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    author: z.string(),
    blocks: z.array(block),
    images: z.array(z.string()), // assets.json ids
  }),
});

const albums = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/albums" }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
    count: z.number().int().nonnegative(),
    photos: z.array(z.string()), // assets.json ids, in gallery order
  }),
});

const notices = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/notices" }),
  schema: z.object({
    id: z.string(),
    page: z.string(),
    n: z.number().int(),
    text: z.string(),
  }),
});

const fact = z.object({
  value: z.string(),
  scan: z.string().optional(), // text as the old site showed it, when corrected
  tel: z.string().optional(),
  source: z.object({ page: z.string(), n: z.number().int() }),
});

const facts = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/facts" }),
  schema: z.object({
    id: z.string(),
    items: z.record(z.string(), fact).optional(), // contact.json
    entries: z
      .array(
        z.object({
          key: z.string(),
          text: z.string().optional(),
          table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
          source: z.string(),
        }),
      )
      .optional(), // transcribed.json
  }),
});

const embeds = defineCollection({
  loader: glob({ pattern: ["*.json", "!_origins.json"], base: "./src/content/embeds" }),
  schema: z.object({
    page: z.string(),
    items: z.array(
      z.object({
        key: z.string(),
        containerHtml: z.string(),
        scriptSrc: z.array(z.string()),
        init: z.string(),
      }),
    ),
  }),
});

export const collections = { pages, newsindex, news, albums, notices, facts, embeds };
