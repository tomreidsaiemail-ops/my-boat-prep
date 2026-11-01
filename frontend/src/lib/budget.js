// Boat Budget: a table list (Description, Product, store link, Date Paid, Cost) seeded from the private "Admin - Boat Budget" list.
export const BUDGET_KIND = "budget";
export const BUDGET_ID = "boatBudget";
export const BUDGET_NAME = "Boat Budget";
export const BUDGET_PREFIX = "Admin - Boat Budget";
export const CURRENCIES = ["NZD", "AUD", "USD", "CAD", "GBP", "EUR", "CHF", "SEK", "NOK", "DKK", "ZAR", "SGD", "HKD", "JPY", "FJD", "XPF"];

export const newBudgetItem = (id, label = "", product = "") => ({ id, label, product, url: "", paid: "", cost: "", checked: false, budget: true });

// "Description | Product" lines; a line without | is just a Description.
export const budgetItems = (lines = [], start = Date.now()) => lines
  .map((l) => { const [d, ...p] = String(l.label || "").split("|"); return [d.trim(), p.join("|").trim()]; })
  .filter(([d]) => d)
  .map(([d, p], n) => newBudgetItem(start + n, d, p));

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
