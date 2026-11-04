import { useEffect, useState } from "react";
import { ArrowRightLeft, ChevronRight, X } from "lucide-react";
import { AttrField } from "@/components/boat/maint/AttrField";
import { DUE_KEY, LAST_KEY, attrText, dueTone, localDate } from "@/lib/maint";

const TONES = { orange: "bg-orange-100", red: "bg-red-100" };

// Wrapping text so long names stay readable on a phone; tap it to edit.
const Cell = ({ value, onSave, testId, bold, flagged, readOnly }) => {
  const [v, setV] = useState(value || "");
  const [editing, setEditing] = useState(false);
  useEffect(() => setV(value || ""), [value]);
  const weight = `${bold ? "font-extrabold" : ""} ${flagged ? "!text-[var(--red)]" : ""}`;
  if (!editing) return (
    <button type="button" onClick={() => !readOnly && setEditing(true)} data-testid={testId} title={readOnly ? undefined : "Tap to edit"}
      className={`budget-cell !h-auto min-h-[38px] break-words py-1.5 text-left text-[15px] leading-snug ${weight}`}>{value}</button>
  );
  return (
    <input value={v} autoFocus onChange={(e) => setV(e.target.value)} maxLength={200} aria-label="Description" placeholder="Description" data-testid={`${testId}-input`}
      onBlur={() => { const next = v.trim(); if (next && next !== value) onSave(next); else setV(value || ""); setEditing(false); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`budget-cell ${weight}`} />
  );
};

// Locale date (dd/mm/ccyy or mm/dd/ccyy) over an invisible native date picker; an inherited category date shows in grey italics.
const DateCell = ({ value, inherited, onChange, label, testId, readOnly }) => (
  <span className="relative block" title={inherited && value ? "From the category due date" : label}>
    <span className={`budget-cell flex items-center overflow-hidden !px-1 font-mono !text-[12px] tracking-tighter ${!value ? "text-slate-400" : inherited ? "italic text-slate-500" : ""}`}
      data-testid={`${testId}-text`}>{value ? localDate(value) : "Date"}</span>
    {!readOnly && <input type="date" value={inherited ? "" : value || ""} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} aria-label={label}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0" data-testid={testId} />}
  </span>
);

export const MaintRow = ({ item, due, open, onOpen, onChange, onDelete, defs, ctx, number, tools, cols }) => {
  const id = item.id;
  const head = !item.indent;
  const attrs = item.attrs || {};
  const setAttrs = (patch) => onChange({ attrs: { ...attrs, ...patch } });
  const tone = dueTone(due.date);
  const filled = defs.some((d) => attrs[d.key]);
  const span = 2 + (cols ? cols.length : 2);
  return (
    <>
      <tr className={`border-t border-[var(--line)] ${head ? "bg-slate-100" : TONES[tone] || ""}`} data-testid={`maint-row-${id}`} data-kind={head ? "category" : "item"} data-tone={tone || "none"}>
        <td className="p-1">
          <div className={`flex items-center ${head ? "" : "pl-1"}`}>
            {head ? <span className="w-1 shrink-0" /> : (
              <button type="button" onClick={onOpen} aria-expanded={open} aria-label={open ? "Hide details" : "Show details"} data-testid={`maint-expand-${id}`}
                className={`inline-flex h-9 w-6 shrink-0 items-center justify-center ${filled ? "text-[var(--navy)]" : "text-slate-400"}`}>
                <ChevronRight className={`h-4 w-4 [transition:transform_.15s] ${open ? "rotate-90" : ""}`} />
              </button>
            )}
            {number}
            <Cell value={item.label} bold={head} flagged={item.flagged} readOnly={ctx.readOnly} testId={`maint-desc-${id}`} onSave={(v) => onChange({ label: v })} />
          </div>
        </td>
        {cols ? cols.map((c) => (
          <td key={c.key} className="p-1">
            {!head && <button type="button" onClick={onOpen} title={`${c.name} (tap to edit)`} data-testid={`maint-col-${c.key}-${id}`}
              className="block w-full break-words px-1 py-1.5 text-left text-[13px] leading-snug">{attrText(c, attrs) || <span className="text-slate-400">-</span>}</button>}
          </td>
        )) : <>
          <td className="p-1">{!head && <DateCell value={attrs[LAST_KEY]} label="Last service date" readOnly={ctx.readOnly} testId={`maint-last-${id}`} onChange={(v) => setAttrs({ [LAST_KEY]: v })} />}</td>
          <td className="p-1"><DateCell value={due.date} inherited={due.inherited} label={head ? "Category service due date" : "Service due date"} readOnly={ctx.readOnly} testId={`maint-due-${id}`} onChange={(v) => setAttrs({ [DUE_KEY]: v })} /></td>
        </>}
        <td className="p-0 text-center">
          {!ctx.readOnly && <button type="button" onClick={onDelete} aria-label={`Delete ${item.label}`} className="inline-flex h-9 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--red)]" data-testid={`maint-delete-${id}`}>
            <X className="h-4 w-4" />
          </button>}
        </td>
      </tr>
      {tools && <tr className={head ? "bg-slate-100" : TONES[tone] || ""} data-testid={`maint-tools-${id}`}><td colSpan={span} className={`px-1 ${head ? "" : "pl-8"}`}>{tools}</td></tr>}
      {open && !head && (
        <tr className={TONES[tone] || ""} data-testid={`maint-details-${id}`}>
          <td colSpan={span} className="px-2 pb-3 pt-1">
            <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 rounded-md border-[1.5px] border-[var(--line)] bg-white p-2.5">
              {defs.map((d) => <AttrField key={d.key} def={d} attrs={attrs} onChange={setAttrs} ctx={ctx} itemId={id} />)}
              {!defs.length && <p className="col-span-2 text-xs text-[var(--muted)]">No attributes set up for this list yet.</p>}
              {ctx.onMove && !ctx.readOnly && (
                <button type="button" onClick={() => ctx.onMove(item)} className="btn-ghost col-span-2 h-10 min-h-0 justify-start gap-1.5 px-3 text-sm" data-testid={`maint-move-${id}`}>
                  <ArrowRightLeft className="h-4 w-4" /> Move to another list...
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
