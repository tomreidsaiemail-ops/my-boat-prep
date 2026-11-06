import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

const Chip = ({ c, active, onPick }) => (
  <button type="button" onClick={() => onPick(c)} data-testid={`invite-pick-${c.entry_id}`} data-status={c.status}
    className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border-[1.5px] px-3 py-1.5 text-sm font-bold transition-colors ${active ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--navy)]"}`}>
    {c.status === "registered" && <CheckCircle2 className={`h-4 w-4 shrink-0 ${active ? "text-green-300" : "text-[var(--green)]"}`} />}
    <span className="truncate">{c.name}</span>
  </button>
);

// Pick who to invite from the skipper's crew register, split into Registered and not yet registered.
export const RegisterPicker = ({ open, online, email, onPick }) => {
  const [crew, setCrew] = useState(null);
  useEffect(() => { if (open && online) api.get("/crew-register").then(({ data }) => setCrew(data.crew)).catch(() => setCrew([])); }, [open, online]);
  if (!crew) return null;
  const on = (c) => c.email.toLowerCase() === email.trim().toLowerCase();
  const groups = [["Registered", crew.filter((c) => c.status === "registered"), "registered"], ["Unregistered", crew.filter((c) => c.status !== "registered"), "unregistered"]];
  return (
    <div className="flex flex-col gap-2" data-testid="invite-register-picker">
      <span className="field-label">Pick from your crew register</span>
      {crew.length === 0 && <p className="text-xs text-[var(--muted)]" data-testid="invite-register-empty">No one on your crew register yet. Add them with Crew Registration, or type their name and email below.</p>}
      {groups.filter(([, l]) => l.length).map(([label, l, key]) => (
        <div key={key} className="flex flex-col gap-1.5" data-testid={`invite-pick-group-${key}`}>
          <span className="text-xs font-bold text-[var(--muted)]">{label} ({l.length})</span>
          <div className="flex flex-wrap gap-1.5">{l.map((c) => <Chip key={c.entry_id} c={c} active={on(c)} onPick={onPick} />)}</div>
        </div>
      ))}
    </div>
  );
};
