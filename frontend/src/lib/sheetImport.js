// Import .xlsx / .csv: every tab becomes an "Imported - ..." custom attribute list (first column = item description).
import * as XLSX from "xlsx";
import { attrText, defaultUnit, slug } from "@/lib/maint";
import { BUDGET_KIND, newBudgetItem } from "@/lib/budget";

export const MAX_ROWS = 2000;
const MAX_COLS = 40;
const cell = (v) => (v instanceof Date ? v : v === null || v === undefined ? "" : String(v).trim());
const blank = (row) => row.every((v) => v === "");
const baseName = (file) => file.name.replace(/\.(xlsx|xlsm|xls|csv)$/i, "").trim() || "Spreadsheet";

const readTab = (ws) => {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false }).map((r) => r.slice(0, MAX_COLS).map(cell));
  const start = rows.findIndex((r) => !blank(r));
  if (start < 0) return { headers: [], rows: [] };
  const width = Math.max(...rows.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, n) => String(rows[start][n] || "").trim() || `Column ${n + 1}`);
  const body = rows.slice(start + 1).filter((r) => !blank(r)).map((r) => headers.map((_, n) => r[n] ?? ""));
  return { headers, rows: body.slice(0, MAX_ROWS), cut: body.length > MAX_ROWS };
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
    return { ...t, file: b.file, name, empty: !t.rows.length, types: t.headers.map(() => "char") };
  }));
};

const isoOf = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const m = String(v).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const dayFirst = new Intl.DateTimeFormat(undefined).formatToParts(new Date(2020, 11, 31))[0].type === "day";
    const [d, mo] = dayFirst ? [m[1], m[2]] : [m[2], m[1]];
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso.slice(1).join("-") : "";
};
const numOf = (v, whole) => {
  const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return "";
  const n = Math.abs(Number(m[0]));
  return whole ? String(Math.min(99999999, Math.round(n))) : String(Math.min(999999.99, Math.round(n * 100) / 100));
};
const text = (v) => (v instanceof Date ? isoOf(v) : String(v));

// The attribute defs for a tab (every column after the first).
export const defsFor = (t) => {
  const keys = [];
  return t.headers.slice(1).map((h, n) => {
    const type = t.types[n + 1];
    let key = slug(h) || "column";
    for (let k = 2; keys.includes(key) || ["description", "category"].includes(key); k += 1) key = `${slug(h) || "column"}_${k}`;
    keys.push(key);
    const name = h.slice(0, 60);
    if (type === "picklist") return { key, name, type, options: [...new Set(t.rows.map((r) => text(r[n + 1]).trim()).filter(Boolean))].slice(0, 60) };
    if (type.startsWith("char")) return { key, name, type: "char", max: type === "char" ? 1000 : 8000 };
    return { key, name, type };
  });
};

const valueOf = (def, v, ctx) => {
  if (v === "") return {};
  if (def.type === "date") { const d = isoOf(v); return d ? { [def.key]: d } : {}; }
  if (def.type.startsWith("integer") || def.type.startsWith("decimal")) {
    const n = numOf(v, def.type.startsWith("integer"));
    if (!n) return {};
    const unit = def.type === "decimal cost" ? ctx.currency : defaultUnit(def.type, def.key, ctx.units);
    return { [def.key]: n, ...(unit ? { [`${def.key}__unit`]: unit } : {}) };
  }
  return { [def.key]: text(v).slice(0, def.max || 1000) };
};

// Items: one category (the tab name) with a row per spreadsheet line.
export const itemsFor = (t, defs, ctx, idBase) => [
  { id: idBase, label: t.tab.slice(0, 200) || "Items", checked: false, maint: true, attrs: {} },
  ...t.rows.map((r, n) => ({
    id: idBase + n + 1, label: (text(r[0]).trim() || `Row ${n + 1}`).slice(0, 200), checked: false, maint: true, indent: true,
    attrs: Object.assign({}, ...defs.map((d, k) => valueOf(d, r[k + 1], ctx))),
  })),
];

// Move one item out of an imported list. Checklists get "Description - Name: value, ..." so no detail is lost.
export const movedRow = (item, defs, target, id) => {
  if (target.kind === "maint") return { id, label: item.label, checked: false, maint: true, indent: true, attrs: { ...(item.attrs || {}) } };
  const details = defs.map((d) => { const v = attrText(d, item.attrs || {}); return v && `${d.name}: ${v}`; }).filter(Boolean).join(", ");
  const label = (details ? `${item.label} - ${details}` : item.label).slice(0, 1000);
  return target.kind === BUDGET_KIND ? { ...newBudgetItem(id, item.label.slice(0, 200)), product: details.slice(0, 300) } : { id, label, checked: false };
};
export const moveInto = (dest, row, target) => {
  if (target.kind !== "maint" || dest.some((i) => !i.indent)) return [...dest, row];
  return [...dest, { id: row.id + 1, label: "Moved items", checked: false, maint: true, attrs: {} }, row];
};
