// Import .xlsx / .csv: every tab becomes an "Imported - ..." custom attribute list (first column = item description).
import * as XLSX from "xlsx";
import { attrText, defaultUnit, slug } from "@/lib/maint";
import { BUDGET_KIND, newBudgetItem } from "@/lib/budget";

export const MAX_ROWS = 2000;
const MAX_COLS = 40;
const cell = (v) => (v instanceof Date ? v : v === null || v === undefined ? "" : String(v).trim());
const blank = (row) => row.every((v) => v === "");
// A row holding only blanks and zeros (0, 0.00, -0) counts as empty and isn't imported.
const zeroish = (v) => v === "" || (!(v instanceof Date) && /^[-+]?0*([.,]0*)?$/.test(String(v).trim()));
const emptyRow = (row) => row.every(zeroish);
const baseName = (file) => file.name.replace(/\.(xlsx|xlsm|xls|csv)$/i, "").trim() || "Spreadsheet";

const readTab = (ws) => {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false }).map((r) => r.slice(0, MAX_COLS).map(cell));
  const start = rows.findIndex((r) => !blank(r));
  if (start < 0) return { headers: [], rows: [] };
  const width = Math.max(...rows.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, n) => String(rows[start][n] || "").trim() || `Column ${n + 1}`);
  const lines = rows.slice(start + 1).filter((r) => !blank(r));
  const body = lines.filter((r) => !emptyRow(r)).map((r) => headers.map((_, n) => r[n] ?? ""));
  return { headers, rows: body.slice(0, MAX_ROWS), cut: body.length > MAX_ROWS, zeroRows: lines.length - body.length };
};

export const readFiles = async (files) => {
  const out = [];
  for (const file of files) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const csv = /\.csv$/i.test(file.name);
    out.push({ file: baseName(file), tabs: wb.SheetNames.map((s) => ({ tab: csv ? baseName(file) : s, ...readTab(wb.Sheets[s]) })) });
  }
  return out;
};

// One entry per tab: name "Imported - <tab>", or "Imported - <file> - <tab>" when several files come in together.
export const planImport = (books, taken) => {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  const multi = books.length > 1;
  return books.flatMap((b) => b.tabs.map((t) => {
    const base = `Imported - ${multi && t.tab !== b.file ? `${b.file} - ` : ""}${t.tab}`.slice(0, 70);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${base} (${n})`;
    used.add(name.toLowerCase());
    return { ...t, file: b.file, name, empty: !t.rows.length, types: guessRoles(t.headers, t.rows) };
  }));
};

// Column roles: "@desc" item description, "@cat" category, "@skip", "@unit" (merged into its value column), or a type.
// Our own Excel exports come back cleanly: Category/Group, Description/Item, "<name> unit", Heading and Due date from are recognised.
const DESC = /^(description|item|item description|name)$/i;
const CAT = /^(category|group)$/i;
const SKIP = /^(heading|due date from)$/i;
const DATES = /^(last service|service due|last service date|next service date|date paid|date)$/i;
const unitOf = (h, headers) => { const m = h.match(/^(.+) unit$/i); return m && headers.some((x) => x.toLowerCase() === m[1].toLowerCase()) ? m[1] : null; };
// A value column with a "<name> unit" column gets a number type that fits its units.
const typeFromUnits = (units) => {
  const u = units.map((x) => String(x).replace(/\s*\(est\.?\)/i, "").trim().toLowerCase()).filter(Boolean);
  const all = (re) => u.length > 0 && u.every((x) => re.test(x));
  if (all(/^(g|kg|lb|lbs|oz)$/)) return "decimal weight";
  if (all(/^(m|mm|cm|feet|ft|inches|in)$/)) return "decimal length";
  if (all(/^(sqm|sq ft|m²|ft²|m2|ft2)$/)) return "decimal area";
  if (all(/^years? old$/)) return "integer age";
  if (all(/^[a-z]{3}$/)) return "decimal cost";
  return "decimal";
};
export const guessRoles = (headers, rows = []) => {
  const d = Math.max(0, headers.findIndex((h) => DESC.test(h.trim())));
  const c = headers.findIndex((h, n) => n !== d && CAT.test(h.trim()));
  return headers.map((h, n) => {
    const x = h.trim();
    if (n === d) return "@desc";
    if (n === c) return "@cat";
    if (SKIP.test(x)) return "@skip";
    if (unitOf(x, headers)) return "@unit";
    if (DATES.test(x)) return "date";
    const u = headers.findIndex((y) => unitOf(y.trim(), headers)?.toLowerCase() === x.toLowerCase());
    if (u >= 0) return typeFromUnits(rows.map((r) => r[u] ?? ""));
    if (/^cost(\s*\([A-Z]{3}\))?$/i.test(x)) return "decimal cost";
    return "char";
  });
};
export const setRole = (types, c, role) => types.map((x, k) => {
  if (k === c) return role;
  return (role === "@desc" || role === "@cat") && x === role ? "char" : x;
});

const isoOf = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const m = String(v).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const dayFirst = new Intl.DateTimeFormat(undefined).formatToParts(new Date(2020, 11, 31))[0].type === "day";
    let [d, mo] = (dayFirst ? [m[1], m[2]] : [m[2], m[1]]).map(Number);
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    const y = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return "";
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const iso = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso.slice(1).join("-") : "";
};
const numOf = (v, whole, positive) => {
  const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return "";
  const raw = Number(m[0]);
  const n = positive ? Math.abs(raw) : raw;
  const cap = whole ? 99999999 : 999999.99;
  const r = whole ? Math.round(n) : Math.round(n * 100) / 100;
  return String(Math.max(-cap, Math.min(cap, r)));
};
const text = (v) => (v instanceof Date ? isoOf(v) : String(v));

const ALIAS = { "last service": "Last service date", "service due": "Next service date" };
// The attribute defs for a tab: every column that isn't the description, category, skipped or a unit column.
export const defsFor = (t) => {
  const keys = [];
  return t.headers.map((h0, col) => ({ h0, col, type: t.types[col] })).filter((c) => !c.type.startsWith("@")).map(({ h0, col, type }) => {
    const h = ALIAS[h0.trim().toLowerCase()] || h0.replace(/\s*\([A-Z]{3}\)$/, "");
    const unitCol = t.headers.findIndex((x, k) => t.types[k] === "@unit" && unitOf(x.trim(), t.headers)?.toLowerCase() === h0.trim().toLowerCase());
    let key = slug(h) || "column";
    for (let k = 2; keys.includes(key) || ["description", "category"].includes(key); k += 1) key = `${slug(h) || "column"}_${k}`;
    keys.push(key);
    const name = h.slice(0, 60);
    const at = { col, ...(unitCol >= 0 ? { unitCol } : {}) };
    if (type === "picklist") return { key, name, type, options: [...new Set(t.rows.map((r) => text(r[col]).trim()).filter(Boolean))].slice(0, 60), ...at };
    if (type.startsWith("char")) return { key, name, type: "char", max: type === "char" ? 1000 : 8000, ...at };
    return { key, name, type, ...at };
  });
};
// Saved attribute defs don't keep the spreadsheet column positions.
export const cleanDefs = (defs) => defs.map(({ col, unitCol, ...d }) => d);

const valueOf = (def, row, ctx) => {
  const v = row[def.col] ?? "";
  if (v === "") return {};
  if (def.type === "date") { const d = isoOf(v); return d ? { [def.key]: d } : {}; }
  if (def.type.startsWith("integer") || def.type.startsWith("decimal")) {
    const n = numOf(v, def.type.startsWith("integer"), ["integer age", "decimal length", "decimal area", "decimal weight"].includes(def.type));
    if (!n) return {};
    const given = def.unitCol >= 0 ? String(row[def.unitCol] ?? "").trim() : "";
    const est = /\(est\.?\)/i.test(given);
    const unit = given.replace(/\s*\(est\.?\)/i, "").trim() || (def.type === "decimal cost" ? ctx.currency : defaultUnit(def.type, def.key, ctx.units));
    return { [def.key]: n, ...(unit ? { [`${def.key}__unit`]: unit } : {}), ...(est ? { [`${def.key}__est`]: "1" } : {}) };
  }
  return { [def.key]: text(v).slice(0, def.max || 1000) };
};

// Items grouped under categories: the Category column's values, or the tab name. Category-only rows (and exported
// checklist headings) become the category itself.
export const itemsFor = (t, defs, ctx, idBase) => {
  const d = t.types.indexOf("@desc");
  const c = t.types.indexOf("@cat");
  const h = t.headers.findIndex((x) => /^heading$/i.test(x.trim()));
  const groups = new Map();
  let id = idBase;
  const group = (name) => {
    const label = (name || t.tab || "Items").slice(0, 200);
    if (!groups.has(label.toLowerCase())) groups.set(label.toLowerCase(), { head: { id: id++, label, checked: false, maint: true, attrs: {} }, items: [] });
    return groups.get(label.toLowerCase());
  };
  t.rows.forEach((r, n) => {
    const desc = text(r[d] ?? "").trim();
    const cat = c >= 0 ? text(r[c] ?? "").trim() : "";
    const attrs = Object.assign({}, ...defs.map((x) => valueOf(x, r, ctx)));
    if (h >= 0 && /^yes$/i.test(text(r[h] ?? "").trim()) && desc) { Object.assign(group(desc).head.attrs, attrs); return; }
    if (c >= 0 && cat && !desc) { Object.assign(group(cat).head.attrs, attrs); return; }
    group(cat).items.push({ id: id++, label: (desc || `Row ${n + 1}`).slice(0, 200), checked: false, maint: true, indent: true, attrs });
  });
  if (!groups.size) group("");
  return [...groups.values()].flatMap((g) => [g.head, ...g.items]);
};

// Move one item out of an imported list. Checklists get "Description - Name: value, ..." so no detail is lost.
const SUFFIXES = ["", "__unit", "__est", "__name"];
const detailText = (defs, attrs) => defs.map((d) => { const v = attrText(d, attrs); return v && `${d.name}: ${v}`; }).filter(Boolean).join(", ");

export const movedRow = (item, defs, target, id, targetDefs = []) => {
  const attrs = item.attrs || {};
  if (target.kind === "maint") {
    // Values go into the target's matching attribute (same name, or same key); anything else stays readable in the description.
    const out = {};
    const left = [];
    defs.forEach((d) => {
      if (!attrs[d.key]) return;
      const t = targetDefs.find((x) => x.name.trim().toLowerCase() === d.name.trim().toLowerCase()) || targetDefs.find((x) => x.key === d.key);
      if (t) SUFFIXES.forEach((s) => { if (attrs[d.key + s]) out[t.key + s] = attrs[d.key + s]; });
      else left.push(d);
    });
    const extra = detailText(left, attrs);
    return { id, label: (extra ? `${item.label} - ${extra}` : item.label).slice(0, 1000), checked: false, maint: true, indent: true, attrs: out };
  }
  const details = detailText(defs, attrs);
  if (target.kind === BUDGET_KIND) {
    const cost = defs.find((d) => d.type === "decimal cost" && attrs[d.key]);
    return { ...newBudgetItem(id, item.label.slice(0, 200)), product: details.slice(0, 300), cost: cost ? attrs[cost.key] : "" };
  }
  return { id, label: (details ? `${item.label} - ${details}` : item.label).slice(0, 1000), checked: false };
};
export const moveInto = (dest, row, target) => {
  if (target.kind !== "maint" || dest.some((i) => !i.indent)) return [...dest, row];
  return [...dest, { id: row.id + 1, label: "Moved items", checked: false, maint: true, attrs: {} }, row];
};
