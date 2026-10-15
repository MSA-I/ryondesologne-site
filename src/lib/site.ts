import uiEntries from "../i18n/ui.fr.json";

type FunctionalEntry = {
  key: string;
  text: string;
  lang: string;
  where: string;
  status: "approved" | "scanned" | "draft";
  approved: boolean;
  source: string;
  ledger_ref?: string;
};

const table = new Map<string, string>();
for (const entry of uiEntries as FunctionalEntry[]) {
  if (table.has(entry.key)) {
    throw new Error(`functional text duplicated: "${entry.key}"`);
  }
  table.set(entry.key, entry.text);
}

/** Functional text by key (ui.fr.json, mirror of 06-build/functional-text.json). Throws when the key is missing. */
export function ft(key: string): string {
  const text = table.get(key);
  if (text === undefined) {
    throw new Error(`functional text missing: "${key}" (add it to 06-build/functional-text.json and ui.fr.json)`);
  }
  return text;
}

/** Main navigation, DESIGN.md §8, in order. */
export const NAV: readonly { label: string; href: string }[] = [
  { label: "Accueil", href: "/" },
  { label: "Restaurant / Traiteur", href: "/pages/le-restaurant.html" },
  { label: "Réservations Gites", href: "/pages/reservations.html" },
  { label: "Réservations Mariage", href: "/pages/salle-de-mariage-et-reception.html" },
  { label: "Réservations Séminaires", href: "/pages/salle-de-mariage-et-reception-1762943209.html" },
  { label: "Colonies, Classes vertes", href: "/pages/colonies-classes-vertes-ecole-alternative.html" },
];

/** Phone lines, verbatim from the board and contact blocks. */
export const PHONES: readonly { label: string; tel: string }[] = [
  { label: "Restaurant : 02 34 33 11 39", tel: "+33234331139" },
  { label: "Gites, Anniversaires et Séminaires 06 04 47 54 92", tel: "+33604475492" },
];

/** Secondary header link, untracked, verbatim capitals (DESIGN.md §9). */
export const HISTORY = { label: "L'HISTOIRE DU LIEU", href: "/pages/presentation.html" } as const;

/**
 * Central switch for the client content placeholders (the Hebrew "[דרוש תוכן: …]" markers).
 * false (Moshe's ruling, 2026-10-15): every placeholder, and the label/line that holds it, renders nothing.
 * Set to true to restore them once the client supplies the missing text; each place keeps its marker text in a comment or constant.
 */
export const showPlaceholders = false;
