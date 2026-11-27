import { itemName, keyOf, mpaLabel } from "@/lib/mpa";
import { withoutYouTube } from "@/lib/youtube";

// Shoppers buy by aisle: each Trip Shopping List aisle heading carries the "shopper" who buys everything under it.
const low = (s) => String(s || "").trim().toLowerCase();
export const itemText = (i) => String(i.label || "").replace(/^\s*\d+[.)]\s*/, "").trim();

export const sameShopper = (a, b) => !!low(b) && low(a) === low(b);

// A shopping row's words without the meal-plan tags, e.g. "Bread – 1 loaf" (an edited row keeps its own words).
export const shopText = (r) => (r.mpa && itemText(r) === mpaLabel(r.mpa) ? r.mpa.base : itemText(r));

const isMealKey = (r) => /^meals \(\d+\)/i.test(itemText(r));

// Each Trip Shopping List aisle (every heading but the Meals key) with its shopper and the rows under it.
export const shopGroups = (rows = []) => rows.reduce((gs, r) => {
  if (!r.indent) gs.push({ id: r.id, aisle: itemText(r), shopper: String(r.shopper || "").trim(), rows: [], key: isMealKey(r) });
  else if (gs.length) gs[gs.length - 1].rows.push(r);
  return gs;
}, []).filter((g) => !g.key);

// A shopper's unticked rows, aisle by aisle: [{ aisle: "Bakery", items: ["Bread – 1 loaf"] }].
export const aisleShopping = (rows, name) => (low(name) ? shopGroups(rows).filter((g) => sameShopper(g.shopper, name))
  .map((g) => ({ aisle: g.aisle, items: g.rows.filter((r) => !r.checked).map(shopText).filter(Boolean) })).filter((g) => g.items.length) : []);

export const shoppingFor = (rows, name) => aisleShopping(rows, name).flatMap((g) => g.items);

// Provisions item -> who buys it: the shopper of the aisle its Trip Shopping List row sits in.
export const provKey = (label) => keyOf(itemName(withoutYouTube(String(label || "").trim())));
export const provShoppers = (rows) => {
  const by = new Map();
  shopGroups(rows).filter((g) => g.shopper).forEach((g) => g.rows.filter((r) => r.mpa?.prov).forEach((r) => by.set(keyOf(itemName(r.mpa.base)), g.shopper)));
  return by;
};
// Provisions items showing who buys them from the Trip Shopping List (old per-item shoppers no longer count).
export const withProvShoppers = (items = [], by) => items.map(({ shopper: _s, ...i }) => (by.get(provKey(i.label)) ? { ...i, shopper: by.get(provKey(i.label)) } : i)); // eslint-disable-line no-unused-vars

// Meal-plan ingredients in the Trip Shopping List (not Provisions or pet rows), aisle by aisle.
export const mealExtras = (rows) => shopGroups(rows).map((g) => ({ ...g, rows: g.rows.filter((r) => r.mpa && !r.mpa.prov && !r.mpa.pet) })).filter((g) => g.rows.length);
export const mealKeyLabel = (rows = []) => itemText(rows.find((r) => !r.indent && isMealKey(r)) || {});

export const shopperGroups = (items) => {
  const by = new Map();
  (items || []).filter((i) => String(i.shopper || "").trim()).forEach((i) => {
    const k = low(i.shopper);
    if (!by.has(k)) by.set(k, { name: i.shopper.trim(), items: [] });
    by.get(k).items.push(i);
  });
  return [...by.values()];
};

export const shoppingMessage = ({ vessel, skipper, name, items, groups = [] }) => [
  `*${name ? `Hi ${name}, here's` : "Here's"} your shopping for ${vessel}*`,
  `${skipper} has asked you to buy these and bring them on board:`,
  ...(groups.length ? groups.flatMap((g) => [`\n*${g.aisle}*`, ...g.items.map((i) => `- ${i}`)]) : items.map((i) => `- ${i}`)),
].join("\n");
