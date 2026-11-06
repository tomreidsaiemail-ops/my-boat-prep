import { CheckCircle2, Loader2, Mail, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { RegStatus } from "@/components/boat/register/RegStatus";

export const RegRow = ({ entry, busy, onEdit, onDelete, onEmail, onWhatsApp }) => {
  const t = `reg-row-${entry.entry_id}`;
  const ask = entry.kind === "crew" && entry.status !== "registered";
  return (
    <li className="flex items-center gap-1.5 px-3 py-2.5" data-testid={t}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" data-testid={`${t}-name`}>{entry.name}</p>
        <p className="truncate text-xs text-[var(--muted)]">{[entry.email, entry.phone].filter(Boolean).join(" · ")}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <RegStatus status={entry.status} testId={`${t}-status`} />
          {(entry.walkthroughs || []).map((w) => (
            <span key={w.boat_id} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-extrabold text-green-800" title={`Signed off ${new Date(w.at).toLocaleDateString()}`} data-testid={`${t}-walkthrough-${w.boat_id}`}>
              {w.vessel} Walkthrough <CheckCircle2 className="h-3.5 w-3.5 text-[var(--green)]" />
            </span>
          ))}
        </div>
      </div>
      {ask && (
        <>
          <button type="button" className="icon-btn" disabled={!!busy} onClick={onEmail} aria-label="Email registration request" title="Email registration request" data-testid={`${t}-email-btn`}>
            {busy === "email" ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Mail className="h-[18px] w-[18px]" />}
          </button>
          <button type="button" className="icon-btn" disabled={!!busy} onClick={onWhatsApp} aria-label="WhatsApp registration request" title="WhatsApp registration request" data-testid={`${t}-whatsapp-btn`}>
            <MessageCircle className="h-[18px] w-[18px]" />
          </button>
        </>
      )}
      <button type="button" className="icon-btn" onClick={onEdit} aria-label="Edit" title="Edit" data-testid={`${t}-edit-btn`}><Pencil className="h-[18px] w-[18px]" /></button>
      <button type="button" className="icon-btn hover:text-[var(--red)]" onClick={onDelete} aria-label="Remove" title="Remove" data-testid={`${t}-delete-btn`}><Trash2 className="h-[18px] w-[18px]" /></button>
    </li>
  );
};
