import { useState } from "react";
import { AlertTriangle, Loader2, UserCheck, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

// An admin email list that switches a launch promotion off (exceptions) or on (inclusions) just for those people.
export const LaunchList = ({ promo, field, title, text, emails = [], warn = {}, onSaved }) => {
  const id = `${promo}-${field}`;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (next, msg) => {
    setBusy(true);
    try {
      const { data } = await api.put(`/admin/promo-codes/${promo}/${field}`, { emails: next });
      onSaved(data);
      toast.success(msg);
      return true;
    } catch (err) { toast.error(apiError(err, `Couldn't save the ${title}`)); return false; }
    finally { setBusy(false); }
  };
  const add = async (e) => {
    e.preventDefault();
    const list = draft.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!list.length) return;
    if (await save([...emails, ...list], `${list.join(", ")} added to the ${title}`)) setDraft("");
  };
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-sky-300 bg-white p-3" data-testid={id}>
      <b className="flex items-center gap-1.5 text-sm text-sky-950">{field === "inclusions" ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />} {title}</b>
      <span className="text-xs text-sky-900">{text}</span>
      <ul className="flex flex-wrap gap-1.5" data-testid={`${id}-list`}>
        {emails.length === 0 && <li className="text-xs text-[var(--muted)]" data-testid={`${id}-empty`}>No emails yet</li>}
        {emails.map((e) => (
          <li key={e} className={`flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-bold ${warn[e] ? "bg-amber-100 text-amber-950" : "bg-sky-100 text-sky-950"}`} title={warn[e] || undefined} data-testid={`${id}-${e}`}>
            {warn[e] && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}{e}
            <button type="button" disabled={busy} onClick={() => save(emails.filter((x) => x !== e), `${e} removed from the ${title}`)} className="rounded-full p-0.5 hover:bg-sky-200" aria-label={`Remove ${e}`} data-testid={`${id}-remove-${e}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {emails.filter((e) => warn[e]).map((e) => <p key={e} className="text-xs font-bold text-amber-800" data-testid={`${id}-warning-${e}`}>{e}: {warn[e]}</p>)}
      <form onSubmit={add} className="flex gap-2" data-testid={`${id}-form`}>
        <input type="email" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="name@example.com" className="field-input min-w-0 flex-1" autoCapitalize="none" data-testid={`${id}-input`} />
        <button type="submit" disabled={busy || !draft.trim()} className="btn-solid shrink-0 px-4" data-testid={`${id}-add-btn`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
      </form>
    </section>
  );
};
