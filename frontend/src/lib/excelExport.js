// Excel exports built on the phone (works offline): one list, every list as its own file in a zip, or one master workbook with a tab per list.
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { DUE_KEY, LAST_KEY, MAINT_KIND, effectiveDue } from "@/lib/maint";
import { costOf, ledgerYear } from "@/lib/budget";
import { areaZones, mapLabel } from "@/lib/zoneColours";

export const stamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fileSafe = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "List";
const yes = (v) => (v ? "Yes" : "");
const DAY_FIRST = (() => { try { return new Intl.DateTimeFormat(undefined).formatToParts(new Date(2000, 10, 22))[0].type === "day"; } catch { return true; } })();
const DATE_FMT = DAY_FIRST ? "dd/mm/yyyy" : "mm/dd/yyyy";
const asDate = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? new Date(`${iso.slice(0, 10)}T00:00:00`) : iso || "");
const asNum = (v) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return String(v ?? "").trim() && Number.isFinite(n) ? n : v ?? ""; };
const pretty = (k) => k.replace(/__/g, " ").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// Group heading of each item (top-level item followed by indented ones).
const headOf = (items, n) => { if (!items[n].indent) return ""; let h = n; while (h > 0 && items[h].indent) h -= 1; return items[h].label || ""; };
const isHeading = (items, n) => !items[n].indent && !!items[n + 1]?.indent;

const checklistRows = (items, labelFor, areaName) => items.map((i, n) => ({
  Group: isHeading(items, n) ? "" : headOf(items, n),
  Item: labelFor(i),
  Heading: yes(isHeading(items, n)),
  Ticked: yes(i.checked),
  Flagged: yes(i.flagged),
  "Boat area": areaName?.(i) || "",
}));

const budgetRows = (items, currency) => [...items].sort((a, b) => ledgerYear(a) - ledgerYear(b)).map((i) => ({
  Year: ledgerYear(i), Description: i.label || "", Product: i.product || "", "Web link": i.url || "", "Date paid": asDate(i.paid), [`Cost${currency ? ` (${currency})` : ""}`]: String(i.cost || "").trim() ? costOf(i) : "",
  "Last change": i.history?.length ? `${i.history.at(-1).field}: ${i.history.at(-1).to}`.slice(0, 200) : "",
}));

const maintRows = (items, defs, custom) => {
  const fields = custom ? defs : defs.filter((d) => d.key !== LAST_KEY && d.key !== DUE_KEY);
  return items.map((i, n) => {
    const a = i.attrs || {};
    const due = effectiveDue(items, n);
    const row = { Category: i.indent ? headOf(items, n) : i.label, Description: i.indent ? i.label : "",
      ...(custom ? {} : { "Last service": asDate(a[LAST_KEY]), "Service due": asDate(due.date), "Due date from": due.date ? (due.inherited ? "Category" : "Own") : "" }) };
    fields.forEach((d) => {
      const v = a[d.key];
      if (d.type === "image") row[d.name] = v ? "Photo attached" : "";
      else if (d.type === "pdf") row[d.name] = v ? a[`${d.key}__name`] || "PDF attached" : "";
      else if (d.type === "date") row[d.name] = asDate(v);
      else if (d.type.startsWith("integer") || d.type.startsWith("decimal")) {
        row[d.name] = asNum(v);
        if (d.type !== "integer" && d.type !== "decimal") row[`${d.name} unit`] = v ? `${a[`${d.key}__unit`] || (d.type === "integer age" ? "years old" : "")}${a[`${d.key}__est`] ? " (est.)" : ""}`.trim() : "";
      } else row[d.name] = v || "";
    });
    return row;
  });
};

export const listRows = (list, items, ctx) => {
  if (list.kind === "budget") return budgetRows(items, ctx.currency);
  if (list.kind === MAINT_KIND) return maintRows(items, ctx.maintDefs(list), list.maint === "custom");
  return checklistRows(items, ctx.labelFor, ctx.areaName);
};

const SKIP = new Set(["weather", "depart", "arrive"]);
const LABELS = { pob: "Persons on board (POB)", mmsi: "MMSI", loa: "LOA", lwl: "LWL", cruise_kn: "Cruising speed (kn)", log_email: "Skipper email", shore_email: "Shore contact email",
  shore_enabled: "Shore contact on", units: "Measurement units", tank_units: "Tank units", year_built: "Year of manufacture", budget_currency: "Currency", trip_days: "Trip duration (days)" };
export const boatRows = (boat) => Object.entries(boat).filter(([k, v]) => !SKIP.has(k) && v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length))
  .map(([k, v]) => ({ Field: LABELS[k] || pretty(k),
    Value: k === "pets" ? v.map((p) => [p.name, p.type].filter(Boolean).join(" - ")).join("; ")
      : Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : typeof v === "boolean" ? yes(v) || "No" : v }));

export const inventoryRows = (areas, boat) => {
  const zones = areaZones(boat, areas);
  const parent = (a) => areas.find((p) => p.id === a.parent_id)?.name || "";
  return areas.flatMap((a) => {
    const base = { "Zone map": zones[a.id]?.map || "", Area: a.name, "Inside": parent(a), "Food area": yes(a.food), "Drinks area": yes(a.drinks) };
    const its = a.items || [];
    return its.length ? its.map((i) => ({ ...base, Item: i.name, Qty: i.qty, "Removed for now": yes(i.removed) })) : [{ ...base, Item: "", Qty: "", "Removed for now": "" }];
  });
};

export const serviceRows = (entries, kind) => [...entries].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((e) => (kind === "engine_log"
  ? { Date: asDate(e.date), "Engine hours": asNum(e.hours), Notes: e.notes || "" }
  : kind === "rigging_log" ? { Date: asDate(e.date), Rigger: e.rigger || "", "Checked items": (e.items || []).join(", "), Notes: e.notes || "" }
  : { Date: asDate(e.date), Electrician: e.electrician || "", Notes: e.notes || "" }));

export const zoneRows = (boat, areas) => (boat?.zone_maps || []).map((m, n) => ({
  "Zone map": mapLabel(m, n), Colour: m.colour || "", "Boat areas pinned": (m.pins || []).map((p) => areas.find((a) => a.id === p.area_id)?.name).filter(Boolean).join(", "),
}));

export const crewRows = (info) => [
  ...(info.crew || []).map((c) => ({ Name: c.name || "", Email: c.email || "", Roles: (c.roles || []).join(", "), Status: "Crew", RSVP: c.rsvp ? c.rsvp[0].toUpperCase() + c.rsvp.slice(1) : "", "Agreement signed": c.agreement?.accepted_at ? asDate(stamp(new Date(c.agreement.accepted_at))) : "" })),
  ...(info.invites || []).map((i) => ({ Name: i.name || "", Email: i.email || "", Roles: (i.roles || []).join(", "), Status: i.declined_at ? "Declined" : "Invited", RSVP: "", "Agreement signed": "" })),
];

const sheetOf = (rows) => {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "Nothing here yet" }], { cellDates: true, dateNF: DATE_FMT });
  const heads = Object.keys(rows[0] || { Note: 1 });
  ws["!cols"] = heads.map((h) => ({ wch: Math.min(60, Math.max(h.length + 2, ...rows.slice(0, 200).map((r) => String(r[h] instanceof Date ? DATE_FMT : r[h] ?? "").length + 1))) }));
  return ws;
};
const tabName = (name, used) => {
  const clean = String(name).replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").replace(/^['\s]+|['\s]+$/g, "");
  const base = (/^history$/i.test(clean) ? `${clean} list` : clean).slice(0, 31).replace(/['\s]+$/, "") || "Sheet";
  let n = base; let k = 2;
  while (used.has(n.toLowerCase())) { const sfx = ` (${k++})`; n = base.slice(0, 31 - sfx.length) + sfx; }
  used.add(n.toLowerCase());
  return n;
};
const book = (sheets) => {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  sheets.forEach((s) => XLSX.utils.book_append_sheet(wb, sheetOf(s.rows), tabName(s.name, used)));
  return wb;
};
const save = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const bytes = (wb) => XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true });

export const fileName = (name, date = stamp()) => `${fileSafe(name)} ${date}.xlsx`;
export const exportOne = (sheet, date = stamp()) => {
  const name = fileName(sheet.name, date);
  save(new Blob([bytes(book([sheet]))], { type: XLSX_TYPE }), name);
  return name;
};
export const exportMaster = (sheets, title, date = stamp()) => {
  const name = fileName(`${title} master`, date);
  save(new Blob([bytes(book(sheets))], { type: XLSX_TYPE }), name);
  return name;
};
export const exportZip = async (sheets, title, date = stamp()) => {
  const zip = new JSZip();
  const used = new Set();
  sheets.forEach((s) => {
    let n = fileName(s.name, date);
    for (let k = 2; used.has(n.toLowerCase()); k += 1) n = fileName(`${s.name} (${k})`, date);
    used.add(n.toLowerCase());
    zip.file(n, bytes(book([s])));
  });
  const name = `${fileSafe(`${title} spreadsheets`)} ${date}.zip`;
  save(await zip.generateAsync({ type: "blob" }), name);
  return name;
};
