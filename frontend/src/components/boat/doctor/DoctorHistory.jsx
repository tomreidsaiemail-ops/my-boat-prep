import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, History, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";

const Thumb = ({ id }) => {
  const [src, setSrc] = useState("");
  const [big, setBig] = useState(false);
  useEffect(() => {
    let url = "";
    api.get(`/ai/doctor-history/${id}/photo`, { responseType: "blob" }).then(({ data }) => { url = URL.createObjectURL(data); setSrc(url); }).catch(() => setSrc("x"));
    return () => url && URL.revokeObjectURL(url);
  }, [id]);
  if (src === "x") return <span className="text-xs text-[var(--muted)]" data-testid={`doctor-history-photo-error-${id}`}>Photo couldn&apos;t load</span>;
  return (
    <button type="button" onClick={() => setBig(!big)} aria-label={big ? "Make photo smaller" : "Make photo bigger"} data-testid={`doctor-history-photo-${id}`}
      className={`shrink-0 overflow-hidden rounded-md border-[1.5px] border-[var(--line)] bg-[var(--panel)] [transition:width_.2s,height_.2s] ${big ? "h-48 w-48" : "h-14 w-14"}`}>
      {src && <img src={src} alt="Photo sent to the Doctor" className="h-full w-full object-cover" />}
    </button>
  );
};

const Entry = ({ a, onForget }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-1.5 border-b border-[var(--line)] py-2 last:border-b-0" data-testid={`doctor-history-item-${a.id}`}>
      <div className="flex items-start gap-2">
        {a.has_photo && <Thumb id={a.id} />}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`doctor-history-toggle-${a.id}`}>
          <span className="block text-xs text-[var(--muted)]">{new Date(a.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{a.pet ? ` · ${a.pet}` : ""}</span>
          <span className="block text-sm font-bold">{a.question}</span>
        </button>
        <button type="button" className="icon-btn h-9 w-9 hover:text-[var(--red)]" onClick={() => onForget(a)} aria-label="Delete this answer" data-testid={`doctor-history-delete-${a.id}`}><Trash2 className="h-4 w-4" /></button>
      </div>
      {open && <p className="whitespace-pre-line rounded-md bg-[var(--panel)] px-3 py-2 text-sm" data-testid={`doctor-history-answer-${a.id}`}>{a.answer}</p>}
    </li>
  );
};

// Past Doctor answers with their photos, newest first; `version` bumps after each new answer.
export const DoctorHistory = ({ version, online }) => {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState(null);
  useEffect(() => {
    if (!open || !online) return;
    api.get("/ai/doctor-history").then(({ data }) => setAnswers(data.answers)).catch((e) => toast.error(apiError(e, "Couldn't load past answers")));
  }, [open, version, online]);
  const forget = async (a) => {
    try { await api.delete(`/ai/doctor-history/${a.id}`); setAnswers((list) => list.filter((x) => x.id !== a.id)); toast.success("Answer deleted"); }
    catch (e) { toast.error(apiError(e, "Couldn't delete that answer")); }
  };
  return (
    <div className="rounded-md border-[1.5px] border-[var(--line)]" data-testid="doctor-history">
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="doctor-history-toggle">
        <History className="h-4 w-4" /> <span className="flex-1">Past answers and photos</span>
        <ChevronDown className={`h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--line)] px-3">
          {!online && <p className="py-2 text-sm text-[var(--muted)]">Past answers need a signal.</p>}
          {online && answers === null && <p className="py-2 text-sm text-[var(--muted)]">Loading...</p>}
          {answers?.length === 0 && <p className="py-2 text-sm text-[var(--muted)]" data-testid="doctor-history-empty">No answers yet.</p>}
          {answers?.length > 0 && <ul>{answers.map((a) => <Entry key={a.id} a={a} onForget={forget} />)}</ul>}
        </div>
      )}
    </div>
  );
};
