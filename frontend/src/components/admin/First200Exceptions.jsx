import { useState } from "react";
import { Loader2, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

// Emails that don't get FIRST200: they see the app as a normal free user, with no FIRST200 banners, and can pay (e.g. with JOINCREW).
export const First200Exceptions = ({ emails = [], onSaved }) => {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (next, msg) => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/promo-codes/first200/exceptions", { emails: next });
      onSaved(data.first200_exceptions);
      toast.success(msg);
      return true;
    } catch (err) { toast.error(apiError(err, "Couldn't save the exception list")); return false; }
    finally { setBusy(false); }
  };
  const add = async (e) => {
    e.preventDefault();
    const list = draft.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!list.length) return;
    if (await save([...emails, ...list], `${list.join(", ")} added: no FIRST200 for ${list.length > 1 ? "them" : "this email"}`)) setDraft("");
  };
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-sky-300 bg-white p-3" data-testid="first200-exceptions">
      <b className="flex items-center gap-1.5 text-sm text-sky-950"><UserX className="h-4 w-4" /> FIRST200 exception list</b>
      <span className="text-xs text-sky-900">These emails don't get FIRST200. When they sign in they're a normal free user: no FIRST200 banners, and they can upgrade and pay (for example with JOINCREW).</span>
      <ul className="flex flex-wrap gap-1.5" data-testid="first200-exceptions-list">
        {emails.length === 0 && <li className="text-xs text-[var(--muted)]" data-testid="first200-exceptions-empty">No exceptions yet</li>}
        {emails.map((e) => (
          <li key={e} className="flex items-center gap-1 rounded-full bg-sky-100 py-0.5 pl-2.5 pr-1 text-xs font-bold text-sky-950" data-testid={`first200-exception-${e}`}>
            {e}
            <button type="button" disabled={busy} onClick={() => save(emails.filter((x) => x !== e), `${e} removed: FIRST200 applies again`)} className="rounded-full p-0.5 hover:bg-sky-200" aria-label={`Remove ${e}`} data-testid={`first200-exception-remove-${e}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2" data-testid="first200-exceptions-form">
        <input type="email" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="name@example.com" className="field-input min-w-0 flex-1" autoCapitalize="none" data-testid="first200-exception-input" />
        <button type="submit" disabled={busy || !draft.trim()} className="btn-solid shrink-0 px-4" data-testid="first200-exception-add-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
      </form>
    </section>
  );
};
