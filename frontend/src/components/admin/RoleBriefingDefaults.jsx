import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { isHeadingLine } from "@/lib/outline";
import { BRIEFING_MAX } from "@/components/boat/agreement/RoleBriefingField";

export const roleKey = (label) => String(label || "").replace(/^\s*\d+[.)]\s*/, "").replace(/^\s*\*\s*/, "").replace(/\s+/g, " ").trim().toLowerCase();

const Role = ({ label, text, onChange }) => {
  const [open, setOpen] = useState(false);
  const key = roleKey(label);
  const t = `template-role-briefing-${key.replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <li className="rounded-md border border-[var(--line)] bg-white" data-testid={t}>
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`${t}-toggle`}>
        <span className="min-w-0 flex-1 truncate">{label.replace(/^\s*\*\s*/, "")}</span>
        {text.trim() && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-900" data-testid={`${t}-badge`}><FileText className="h-3 w-3" />Briefing</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <textarea value={text} onChange={(e) => onChange(e.target.value.slice(0, BRIEFING_MAX))} rows={4} maxLength={BRIEFING_MAX}
          placeholder="e.g. Watch out for the boom at all times!" aria-label={`Default Role Briefing for ${label}`}
          className="field-input mx-3 mb-3 !h-auto min-h-[6rem] w-[calc(100%-1.5rem)] resize-y py-2 font-normal leading-snug" data-testid={`${t}-input`} />
      )}
    </li>
  );
};

// Admin "Crew Roles" template: a default Role Briefing for any role, filled into skippers' Crew Roles where they have none.
export const RoleBriefingDefaults = ({ lines, value, onChange }) => {
  const roles = [...new Map(lines.filter((l) => !isHeadingLine(l) && roleKey(l)).map((l) => [roleKey(l), l])).values()];
  const set = (label) => (text) => onChange({ ...value, [roleKey(label)]: text });
  const count = roles.filter((l) => (value[roleKey(l)] || "").trim()).length;
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-[var(--bg,#f6f7f9)] p-3" data-testid="template-role-briefings">
      <h3 className="text-sm font-bold">Default Role Briefings <span className="font-normal text-[var(--muted)]">({count} of {roles.length} roles)</span></h3>
      <p className="text-xs text-[var(--muted)]">Tap a role to write its default briefing. Saving fills it into every boat's Crew Roles where the skipper has no briefing for that role yet. A skipper's own or blanked briefing is never changed.</p>
      <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
        {roles.map((l) => <Role key={roleKey(l)} label={l} text={value[roleKey(l)] || ""} onChange={set(l)} />)}
      </ul>
    </section>
  );
};
