// Magic Bartender: cocktails from the F (food) and D (drinks) boat areas, plus an optional Bartender Photo.
export const BARTENDER_KIND = "bartender";
export const BARTENDER_NAME = "Magic Bartender Cocktails";

export const barAreas = (areas = []) => areas.filter((a) => a.food || a.drinks);
export const areaIngredients = (areas) => barAreas(areas).flatMap((a) => (a.items || []).filter((i) => !i.removed).map((i) => i.name));
export const uniqueNames = (names) => [...new Map(names.map((n) => String(n || "").trim()).filter(Boolean).map((n) => [n.toLowerCase(), n])).values()];

export const cocktailItems = (cocktails, start = Date.now()) => cocktails.map((c, n) => ({
  id: start + n, label: c.name, photo: c.photo || "", youtube: c.youtube, uses: c.uses || [], missing: c.missing || [], checked: false, cocktail: true,
}));
export const cocktailLabel = (i) => `${i.label}${i.missing?.length ? ` (buy: ${i.missing.join(", ")})` : ""} - ${i.youtube}`;
