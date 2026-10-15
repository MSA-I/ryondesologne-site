// Build-time content access. Every page text goes through t() / blocks() / approved()
// / notice() / fact(): components never type copy.
type Block = { n: number; tag: string; text: string; href?: string };
type Doc = { id: string; blocks: Block[] };
type Approved = { page: string; kind: string; where: string; approved: string; original?: string };
type Table = { headers: string[]; rows: string[][] };
type Fact = { value: string; scan?: string; tel?: string; source: { page: string; n: number } };

const load = <T>(g: Record<string, unknown>): Record<string, T> => {
  const o: Record<string, T> = {};
  for (const [p, m] of Object.entries(g)) {
    const id = p.split("/").pop()!.replace(/\.json$/, "");
    o[id] = ((m as { default?: T }).default ?? m) as T;
  }
  return o;
};

const docs: Record<string, Doc> = {
  ...load<Doc>(import.meta.glob("../content/newsindex/*.json", { eager: true })),
  ...load<Doc>(import.meta.glob("../content/news/*.json", { eager: true })),
  ...load<Doc>(import.meta.glob("../content/pages/*.json", { eager: true })),
};
const noticeMap = load<{ text: string }>(import.meta.glob("../content/notices/*.json", { eager: true }));
const factFiles = load<{ items?: Record<string, Fact>; entries?: { key: string; text?: string; table?: Table; source: string }[] }>(
  import.meta.glob("../content/facts/*.json", { eager: true }),
);
const factItems = factFiles["contact"].items!;
const transcribedEntries = factFiles["transcribed"].entries ?? [];
const transcribed = new Map(transcribedEntries.filter((e) => e.text !== undefined).map((e) => [e.key, e.text as string]));
const tables = new Map(transcribedEntries.filter((e) => e.table).map((e) => [e.key, e.table as Table]));
const approvedList = (
  (import.meta.glob("../content/approved.json", { eager: true }) as Record<string, { default: Approved[] }>)[
    "../content/approved.json"
  ].default
);

const doc = (pageId: string): Doc => {
  const d = docs[pageId];
  if (!d) throw new Error(`content: unknown page "${pageId}"`);
  return d;
};

// A rewrite applies only on its own page, for body/cta/label kinds (never meta-*, alt*),
// and only when its `original` equals the block text. No cross-page fallback.
export const rewriteKind = (where: string): boolean =>
  /^(body|cta)(:|$)/.test(where) || where.startsWith("label");

export const rewriteWith = (list: Approved[], pageId: string, text: string): string => {
  const hit = list.find((e) => e.page === pageId && e.original === text && rewriteKind(e.where));
  return hit ? hit.approved : text;
};

const rewrite = (pageId: string, text: string): string => rewriteWith(approvedList, pageId, text);

/** Block text, or the approved rewrite whose `original` equals it. Throws on a missing block. */
export function t(pageId: string, n: number): string {
  const b = doc(pageId).blocks.find((x) => x.n === n);
  if (!b) throw new Error(`content: no block ${n} in "${pageId}"`);
  return rewrite(pageId, b.text);
}

/** Blocks from..to inclusive, text rewritten where approved. */
export function blocks(pageId: string, from: number, to: number): Block[] {
  return doc(pageId)
    .blocks.filter((b) => b.n >= from && b.n <= to)
    .map((b) => ({ ...b, text: rewrite(pageId, b.text) }));
}

/** Approved text for a `where` key (meta-title, meta-description, label:…, alt, body, cta). */
export function approved(where: string, pageId?: string): string {
  const hit = approvedList.find((e) => e.where === where && (pageId === undefined || e.page === pageId));
  if (!hit) throw new Error(`content: no approved text for "${where}"${pageId ? ` on "${pageId}"` : ""}`);
  return hit.approved;
}

export function notice(id: string): string {
  const n = noticeMap[id];
  if (!n) throw new Error(`content: unknown notice "${id}"`);
  return n.text;
}

export function fact(key: string): string {
  const f = factItems[key];
  if (!f) throw new Error(`content: unknown fact "${key}"`);
  return f.value;
}

/** International tel: value for phone facts (href use). */
export function factTel(key: string): string {
  const f = factItems[key];
  if (!f?.tel) throw new Error(`content: fact "${key}" has no tel`);
  return f.tel;
}

/** Image-baked client text, transcribed verbatim (facts/transcribed.json). Throws on a missing key. */
export function tr(key: string): string {
  const v = transcribed.get(key);
  if (v === undefined) throw new Error(`content: unknown transcribed key "${key}"`);
  return v;
}

/** Table baked into an image, transcribed verbatim (facts/transcribed.json). Throws on a missing key. */
export function trTable(key: string): Table {
  const v = tables.get(key);
  if (!v) throw new Error(`content: unknown transcribed table "${key}"`);
  return v;
}
