import { CheckCircle2, Loader2, Mail, MessageCircle, Pencil, Trash2, Zap } from "lucide-react";
import { RegStatus } from "@/components/boat/register/RegStatus";
import { localWhen, timeAgo } from "@/lib/timeAgo";

export const RegRow = ({ entry, busy, onEdit, onDelete, onEmail, onWhatsApp }) => {
  const t = `reg-row-${entry.entry_id}`;
  const quick = entry.kind === "crew" && entry.quick_reg && entry.status === "registered";
  // Quick Reg crew can still be asked to add their own details.
  const ask = entry.kind === "crew" && (entry.status !== "registered" || quick);
  const askWhat = quick ? "Ask them to add their registration details" : "registration request";
  const crewAdded = entry.kind === "crew" && entry.status === "registered" && !quick && (entry.crew_added_at || entry.user_id);
  return (
    <li className="flex items-center gap-1.5 px-3 py-2.5" data-testid={t}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" data-testid={`${t}-name`}>{entry.name}</p>
        <p className="truncate text-xs text-[var(--muted)]">{[entry.email, entry.phone].filter(Boolean).join(" · ")}</p>
        {entry.kind === "crew" && entry.registered_at && <p className="text-xs font-bold text-emerald-800" data-testid={`${t}-registered-at`}>Registered {localWhen(entry.registered_at)}</p>}
        <div className="mt-1 flex flex-wrap gap-1">
          <RegStatus status={entry.status} testId={`${t}-status`} />
          {quick && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-900" data-testid={`${t}-quick-reg`}>
              <Zap className="h-3.5 w-3.5 fill-amber-300 text-amber-600" /> Registered via Quick Reg{entry.requested_at ? " · details requested" : ""}
            </span>
          )}
          {crewAdded && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-extrabold text-green-800" data-testid={`${t}-crew-added`}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--green)]" /> Crew member added registration details
            </span>
          )}
          {(entry.walkthroughs || []).map((w) => (
            <span key={w.boat_id} className="inline-flex flex-wrap items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-extrabold text-green-800" data-testid={`${t}-walkthrough-${w.boat_id}`}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--green)]" /> {w.vessel} Walkthrough {w.quick ? `quick accept ${localWhen(w.at)} (full walk-through ${timeAgo(w.full_at)})` : localWhen(w.at)}
            </span>
          ))}
        </div>
      </div>
      {ask && (
        <>
          <button type="button" className="icon-btn" disabled={!!busy} onClick={onEmail} aria-label={`Email ${askWhat}`} title={`Email ${askWhat}`} data-testid={`${t}-email-btn`}>
            {busy === "email" ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Mail className="h-[18px] w-[18px]" />}
          </button>
          <button type="button" className="icon-btn" disabled={!!busy} onClick={onWhatsApp} aria-label={`WhatsApp ${askWhat}`} title={`WhatsApp ${askWhat}`} data-testid={`${t}-whatsapp-btn`}>
            <MessageCircle className="h-[18px] w-[18px]" />
          </button>
        </>
      )}
      <button type="button" className="icon-btn" onClick={onEdit} aria-label="Edit" title="Edit" data-testid={`${t}-edit-btn`}><Pencil className="h-[18px] w-[18px]" /></button>
      <button type="button" className="icon-btn hover:text-[var(--red)]" onClick={onDelete} aria-label="Remove" title="Remove" data-testid={`${t}-delete-btn`}><Trash2 className="h-[18px] w-[18px]" /></button>
    </li>
  );
};
