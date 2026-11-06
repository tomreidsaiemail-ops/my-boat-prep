import { useState } from "react";
import { CheckCircle2, Palette, TriangleAlert, XCircle } from "lucide-react";
import { LIGHT, RAINBOW, ZONE_COLOURS, colourName } from "@/lib/zoneColours";

const LINE = /^\s*\*?\s*(.+?)\s*[-–:,=]\s*([A-Za-z]+(?: [A-Za-z]+)?)\s*\*?\s*$/;
const ink = (c) => (LIGHT.has(c) ? "#0f172a" : "#fff");
const near = (word) => {
  const w = word.toLowerCase();
  return RAINBOW.find((c) => c.toLowerCase().startsWith(w.slice(0, 3))) || RAINBOW.find((c) => c.toLowerCase().includes(w.slice(0, 4)));
};

// Checks each "Zone - Colour" line the way the app reads it.
export const checkPalette = (lines) => {
  const byColour = {}, byZone = {};
  const rows = lines.map((raw, i) => {
    if (!raw.trim()) return { n: i + 1, raw, kind: "skip" };
    const m = raw.match(LINE);
    if (!m) return { n: i + 1, raw, kind: "bad", why: "Use the format Zone - Colour, e.g. Cockpit - Gold" };
    const zone = m[1].replace(/^\*+|\*+$/g, "").trim(), typed = m[2].trim(), colour = colourName(typed);
    if (!colour) {
      const tip = near(typed);
      return { n: i + 1, raw, zone, kind: "bad", why: `"${typed}" isn't one of the 100 colours${tip ? `. Did you mean ${tip}?` : ""}` };
    }
    (byColour[colour] = byColour[colour] || []).push(i + 1);
    (byZone[zone.toLowerCase()] = byZone[zone.toLowerCase()] || []).push(i + 1);
    return { n: i + 1, raw, zone, colour, kind: "ok", note: colour.toLowerCase() !== typed.toLowerCase().replace(/\s+/g, " ") ? `read as ${colour}` : "" };
  });
  rows.forEach((r) => {
    if (r.kind !== "ok") return;
    const twin = byColour[r.colour].filter((n) => n !== r.n);
    const same = byZone[r.zone.toLowerCase()].filter((n) => n !== r.n);
    if (twin.length) { r.kind = "warn"; r.why = `${r.colour} is also used on line ${twin.join(", ")}, so photos can't tell these zones apart`; }
    else if (same.length) { r.kind = "warn"; r.why = `${r.zone} is also listed on line ${same.join(", ")}`; }
  });
  const used = {};
  rows.forEach((r) => { if (r.colour) used[r.colour] = used[r.colour] ? `${used[r.colour]}, ${r.zone}` : r.zone; });
  return { rows: rows.filter((r) => r.kind !== "skip"), used };
};

const ICON = { ok: [CheckCircle2, "text-[var(--green)]"], warn: [TriangleAlert, "text-amber-600"], bad: [XCircle, "text-[var(--red)]"] };

const Row = ({ r }) => {
  const [Icon, cls] = ICON[r.kind];
  return (
    <li className="flex items-start gap-2 py-1.5 text-sm" data-testid={`palette-test-line-${r.n}`} data-kind={r.kind}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
      {r.colour && <span className="mt-0.5 h-4 w-6 shrink-0 rounded ring-1 ring-slate-300" style={{ background: ZONE_COLOURS[r.colour] }} />}
      <span className="min-w-0">
        <span className="text-[var(--muted)]">{r.n}.</span> <b>{r.raw.trim()}</b>
        {(r.why || r.note) && <span className={`block text-xs ${r.kind === "bad" ? "text-[var(--red)]" : r.kind === "warn" ? "text-amber-700" : "text-[var(--muted)]"}`}>{r.why || r.note}</span>}
      </span>
    </li>
  );
};

// Admin-only: test "Admin - Zone Map Predetermined Colours" before saving, and see every colour that can be used.
export const PaletteTest = ({ lines }) => {
  const [open, setOpen] = useState(false);
  const { rows, used } = checkPalette(lines);
  const bad = rows.filter((r) => r.kind === "bad").length, warn = rows.filter((r) => r.kind === "warn").length;
  return (
    <div className="flex flex-col gap-2" data-testid="palette-test">
      <button type="button" className="btn-ghost h-10 justify-center gap-2 text-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="palette-test-btn">
        <Palette className="h-4 w-4" /> {open ? "Hide palette test" : "Test palette"}
      </button>
      {open && (
        <div className="flex flex-col gap-3 rounded-md border-[1.5px] border-[var(--line)] bg-slate-50 p-3" data-testid="palette-test-panel">
          <p className="text-sm font-bold" data-testid="palette-test-summary">
            {rows.length - bad - warn} of {rows.length} lines OK{warn ? `, ${warn} to check` : ""}{bad ? `, ${bad} won't work` : ""}. {Object.keys(used).length} of {RAINBOW.length} colours used.
          </p>
          <ul className="flex flex-col divide-y divide-slate-200">{rows.map((r) => <Row key={r.n} r={r} />)}</ul>
          <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">All {RAINBOW.length} colours you can use</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" data-testid="palette-test-colours">
            {RAINBOW.map((c) => (
              <span key={c} className={`flex min-h-9 items-center justify-between gap-1 rounded-md px-2 py-1 text-[11px] font-extrabold ${used[c] ? "ring-2 ring-[var(--navy)]" : LIGHT.has(c) ? "ring-1 ring-slate-300" : ""}`}
                style={{ background: ZONE_COLOURS[c], color: ink(c) }} title={used[c] ? `Used by ${used[c]}` : "Free to use"} data-testid={`palette-test-colour-${c.toLowerCase().replace(/\s+/g, "-")}`}>
                <span>{c}</span>{used[c] ? <span className="truncate text-[10px] font-bold opacity-90">{used[c]}</span> : <span className="text-[10px] font-bold opacity-75">free</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
