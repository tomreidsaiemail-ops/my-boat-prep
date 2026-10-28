import { Check, X } from "lucide-react";

const STYLES = {
  in: { cls: "bg-emerald-100 text-emerald-900", icon: Check, text: "I'm in" },
  out: { cls: "bg-red-100 text-red-900", icon: X, text: "Can't make it" },
};

export const RsvpBadge = ({ status, testId }) => {
  const s = STYLES[status];
  if (!s) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600" data-testid={testId}>No reply yet</span>;
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`} data-testid={testId}><Icon className="h-3 w-3" />{s.text}</span>;
};

export const RsvpSummary = ({ crew, onClear }) => {
  const by = (st) => crew.filter((m) => m.rsvp === st).map((m) => m.name || m.email);
  const yes = by("in"), no = by("out");
  if (!crew.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border-[1.5px] border-[var(--line)] bg-slate-50 p-3 text-sm" data-testid="rsvp-summary">
      <div className="flex items-center justify-between gap-2">
        <span className="field-label">Voyage replies</span>
        {onClear && (yes.length + no.length > 0) && (
          <button type="button" className="text-xs font-bold text-[var(--navy)] underline underline-offset-2" onClick={onClear} data-testid="rsvp-clear-btn">Clear replies</button>
        )}
      </div>
      <p data-testid="rsvp-summary-in"><b className="text-emerald-800">I'm in:</b> {yes.join(", ") || "nobody yet"}</p>
      <p data-testid="rsvp-summary-out"><b className="text-red-800">Can't make it:</b> {no.join(", ") || "nobody"}</p>
      <p className="text-xs text-[var(--muted)]" data-testid="rsvp-summary-waiting">{crew.length - yes.length - no.length} still to reply</p>
    </div>
  );
};
