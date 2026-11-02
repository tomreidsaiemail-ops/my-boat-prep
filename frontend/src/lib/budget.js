// Boat Budget: a table list (Description, Product, store link, Date Paid, Cost) seeded from the private "Admin - Boat Budget" list.
export const BUDGET_KIND = "budget";
export const BUDGET_ID = "boatBudget";
export const BUDGET_NAME = "Boat Budget";
export const BUDGET_PREFIX = "Admin - Boat Budget";
export const CURRENCIES = ["NZD", "AUD", "USD", "CAD", "GBP", "EUR", "CHF", "SEK", "NOK", "DKK", "ZAR", "SGD", "HKD", "JPY", "FJD", "XPF"];

const EURO = ["IE", "FR", "DE", "ES", "PT", "IT", "NL", "BE", "AT", "FI", "GR", "HR", "MT", "CY", "SI", "SK", "EE", "LV", "LT", "LU", "MC"];
const BY_REGION = { NZ: "NZD", AU: "AUD", US: "USD", CA: "CAD", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", ZA: "ZAR", SG: "SGD", HK: "HKD", JP: "JPY", FJ: "FJD", PF: "XPF", NC: "XPF",
  ...Object.fromEntries(EURO.map((r) => [r, "EUR"])) };
// The skipper's pick, else a guess from the phone's region (e.g. en-NZ -> NZD), else none.
export const budgetCurrency = (boat) => {
  if (boat.budget_currency) return boat.budget_currency;
  const langs = typeof navigator === "undefined" ? [] : navigator.languages || [navigator.language];
  const region = langs.map((l) => String(l || "").split("-")[1]?.toUpperCase()).find((r) => BY_REGION[r]);
  return region ? BY_REGION[region] : "";
};

export const newBudgetItem = (id, label = "", product = "") => ({ id, label, product, url: "", paid: "", cost: "", checked: false, budget: true });

// "Description | Product" lines; a line without | is just a Description.
export const budgetItems = (lines = [], start = Date.now()) => lines
  .map((l) => { const [d, ...p] = String(l.label || "").split("|"); return [d.trim(), p.join("|").trim()]; })
  .filter(([d]) => d)
  .map(([d, p], n) => newBudgetItem(start + n, d, p));

export const hasBudget = (s) => s.registry.some((l) => l.kind === BUDGET_KIND || l.id === BUDGET_ID);
const nameClash = (s) => s.registry.some((l) => l.name.toLowerCase() === BUDGET_NAME.toLowerCase());
// Adds an empty Boat Budget from the template lines (first seed, or Reset All after a delete).
export const withBudget = (s, lines) => (hasBudget(s) ? s : {
  ...s,
  registry: [...s.registry, { id: BUDGET_ID, name: nameClash(s) ? `My ${BUDGET_NAME}` : BUDGET_NAME, isSystem: false, kind: BUDGET_KIND }],
  data: { ...s.data, [BUDGET_ID]: budgetItems(lines) },
  deleted_lists: (s.deleted_lists || []).filter((id) => id !== BUDGET_ID),
});
// Reset All offers the Boat Budget only once it has been deleted, so it can never wipe a budget in use.
export const budgetResetOption = (s) => ((s.deleted_lists || []).includes(BUDGET_ID) && !hasBudget(s)
  ? [{ id: BUDGET_ID, name: BUDGET_NAME, deleted: true, clash: false }] : []);

export const costOf = (i) => { const n = parseFloat(String(i.cost || "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
export const yearOf = (i) => (/^\d{4}-\d{2}-\d{2}$/.test(i.paid || "") ? Number(i.paid.slice(0, 4)) : null);
export const ageTone = (i, now = new Date().getFullYear()) => {
  const y = yearOf(i);
  if (!y) return "";
  return y === now - 1 ? "orange" : y <= now - 2 ? "red" : "";
};
export const sumAll = (items) => items.reduce((t, i) => t + costOf(i), 0);
export const sumYear = (items, year) => sumAll(items.filter((i) => yearOf(i) === year));

export const money = (n, currency) => {
  try { if (currency) return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n); } catch { /* unknown code */ }
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const shortDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
export const budgetLabel = (i, currency) => [i.label, i.product, i.paid && `paid ${shortDate(i.paid)}`, String(i.cost || "").trim() && money(costOf(i), currency)].filter(Boolean).join(" - ");
export const storeUrl = (raw) => {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
