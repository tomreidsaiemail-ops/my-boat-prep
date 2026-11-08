// Magic Bartender: cocktails from the F (food) and D (drinks) cupboards, plus an optional Bartender Photo.
export const BARTENDER_KIND = "bartender";
export const BARTENDER_NAME = "Magic Bartender Cocktails";

export const barAreas = (areas = []) => areas.filter((a) => a.food || a.drinks);
export const areaIngredients = (areas) => barAreas(areas).flatMap((a) => (a.items || []).filter((i) => !i.removed).map((i) => i.name));
export const uniqueNames = (names) => [...new Map(names.map((n) => String(n || "").trim()).filter(Boolean).map((n) => [n.toLowerCase(), n])).values()];

export const cocktailItems = (cocktails, start = Date.now()) => cocktails.map((c, n) => ({
  id: start + n, label: c.name, photo: c.photo || "", youtube: c.youtube, uses: c.uses || [], missing: c.missing || [], checked: false, cocktail: true,
  ...(c.mocktail ? { mocktail: true } : {}),
}));
export const cocktailLabel = (i) => `${i.label}${i.mocktail ? " (alcohol-free)" : ""}${i.missing?.length ? ` (buy: ${i.missing.join(", ")})` : ""} - ${i.youtube}`;

// Every missing ingredient once, with the cocktails that need it.
export const missingIngredients = (items) => {
  const map = new Map();
  items.forEach((c) => (c.missing || []).forEach((m) => {
    const k = m.trim().toLowerCase();
    if (!k) return;
    const e = map.get(k) || { name: m.trim(), for: [] };
    e.for.push(c.label);
    map.set(k, e);
  }));
  return [...map.values()];
};

const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
// Today's Sundowner: the same pick all day, preferring cocktails with nothing missing.
export const sundownerPick = (items, dayKey, mocktail = false) => {
  const pool = items.filter((i) => !!i.mocktail === mocktail);
  const ready = pool.filter((i) => !i.missing?.length);
  const from = ready.length ? ready : pool;
  return from.length ? from[hash(`${dayKey}${mocktail ? "m" : "c"}`) % from.length] : null;
};
