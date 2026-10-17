import { useState } from "react";
import { toast } from "sonner";
import { HelpCircle, Plus } from "lucide-react";
import { FaqRow } from "@/components/boat/FaqRow";
import { FaqDialog } from "@/components/boat/FaqDialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

export const FaqList = ({ faq, admin, online, onSave }) => {
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [doomed, setDoomed] = useState(null);
  const isDup = (q, exceptId) => faq.some((f) => f.id !== exceptId && f.question.toLowerCase() === q.toLowerCase());

  const commit = async (next) => {
    if (!online) { toast.error("Go online to update the FAQ"); return "You're offline"; }
    setBusy(true);
    try { await onSave(next); return true; }
    catch (e) { const t = typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Couldn't save, please try again"; toast.error(t); return t; }
    finally { setBusy(false); }
  };
  const move = (i, dir) => { const next = [...faq]; [next[i], next[i + dir]] = [next[i + dir], next[i]]; commit(next); };
  const confirm = async (form) => {
    const editing = dialog.item;
    if (isDup(form.question, editing?.id)) return "That question is already in the FAQ";
    const next = editing ? faq.map((f) => (f.id === editing.id ? { ...f, ...form } : f)) : [...faq, { id: Date.now(), ...form }];
    const res = await commit(next);
    if (res === true) { setDialog(null); toast.success(editing ? "FAQ saved" : "FAQ added"); }
    return res;
  };
  const remove = async () => { const f = doomed; setDoomed(null); if ((await commit(faq.filter((x) => x.id !== f.id))) === true) toast.success("FAQ deleted"); };

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-sky-200 bg-sky-50 p-3.5 text-sm leading-relaxed text-sky-950" data-testid="faq-intro">
        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{admin ? "You're the admin: add, edit, reorder and delete questions here. Every skipper sees this list." : "Answers to common questions about My Boat Prep."}</p>
      </div>
      <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="faq-list">
        {faq.length === 0 && <li className="p-4 text-sm font-medium text-[var(--muted)]" data-testid="faq-empty">{admin ? "No questions yet. Add the first one below." : "No questions yet. Check back soon."}</li>}
        {faq.map((f, i) => (
          <FaqRow key={f.id} item={f} admin={admin} busy={busy} first={i === 0} last={i === faq.length - 1}
            onEdit={() => setDialog({ item: f })} onDelete={() => setDoomed(f)} onMove={(d) => move(i, d)} />
        ))}
      </ul>
      {admin && (
        <button type="button" className="btn-solid flex h-12 items-center justify-center gap-2" disabled={busy}
          onClick={() => (online ? setDialog({}) : toast.error("Go online to update the FAQ"))} data-testid="faq-add-btn">
          <Plus className="h-5 w-5" strokeWidth={3} /> Add a question
        </button>
      )}
      <FaqDialog open={!!dialog} initial={dialog?.item} onConfirm={confirm} onClose={() => setDialog(null)} />
      <ConfirmDelete item={doomed && { name: doomed.question }} onClose={() => setDoomed(null)} onConfirm={remove} />
    </>
  );
};
