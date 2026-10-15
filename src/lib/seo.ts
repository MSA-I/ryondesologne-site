// SEO helpers shared by BaseHead and the news templates (P7 fix p7-fix-seo). No copy is typed here: labels come from NAV
// or are the page's own H1, verbatim.
import { NAV } from "./site";

/** HTML entities decoded until stable (the old excerpts are double-escaped: "&amp;nbsp;"). */
export function decodeEntities(s: string): string {
  let cur = s;
  for (let i = 0; i < 4; i++) {
    const next = cur
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** Plain one-line text: entities decoded, non-breaking and repeated spaces collapsed. */
export const plain = (s: string): string => decodeEntities(s).replace(/[\u00a0\u202f\s]+/g, " ").trim();

/** At most `max` characters; cut at a word boundary and ended with "…" when cut (a trailing "..." of the old excerpt counts as a cut). */
export function excerpt(s: string, max = 160): string {
  let t = plain(s);
  const wasCut = /(\.\.\.|…)$/.test(t);
  t = t.replace(/\s*(\.\.\.|…)$/, "");
  if (!wasCut && t.length <= max) return t;
  if (wasCut && t.length + 1 <= max) return t.replace(/[\s,;:.\-–]+$/, "") + "…";
  let cut = t.slice(0, max - 1);
  if (!/\s/.test(t.charAt(max - 1))) {
    const sp = cut.lastIndexOf(" ");
    cut = sp > 0 ? cut.slice(0, sp) : cut;
  }
  return cut.replace(/[\s,;:.\-–]+$/, "") + "…";
}

const nav = (href: string) => NAV.find((n) => n.href === href)!.label;
/** Inner pages that render no Breadcrumbs component: path -> label of the last crumb (nav label, else the page's own H1). */
export const CRUMB_ONLY: Record<string, string> = {
  "/pages/le-restaurant.html": nav("/pages/le-restaurant.html"),
  "/pages/reservations.html": nav("/pages/reservations.html"),
  "/pages/salle-de-mariage-et-reception.html": nav("/pages/salle-de-mariage-et-reception.html"),
  "/pages/salle-de-mariage-et-reception-1762943209.html": nav("/pages/salle-de-mariage-et-reception-1762943209.html"),
  "/pages/colonies-classes-vertes-ecole-alternative.html": nav("/pages/colonies-classes-vertes-ecole-alternative.html"),
  "/pages/notre-territoire-la-sologne.html": "Notre territoire la Sologne",
  "/pages/presentation.html": "Présentation",
  "/pages/animation-nature.html": "Objectif zéro voiture pour votre séjour!",
  "/reservation/": "Réservation",
  "/actualites/": "Actualités",
  "/contact/contact.html": "Contact",
  "/newsletters/subscribe/": "Newsletter",
  "/album/": "Album",
};
export const HOME_LABEL = NAV[0].label;
