import { useState } from "react";
import { Loader2, Stethoscope, X } from "lucide-react";
import { api, apiError } from "@/lib/api";

const AnswerCard = ({ answer, left, onClose }) => (
  <div className="flex flex-col gap-2 rounded-md border-l-4 border-[var(--red)] bg-[var(--panel)] px-3 py-2" data-testid="doctor-answer-card">
    <div className="flex items-center gap-2">
      <span className="flex flex-1 items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide"><Stethoscope className="h-4 w-4" /> The Magic Marine Doctor says</span>
      <button type="button" className="icon-btn h-8 w-8" aria-label="Close answer" onClick={onClose} data-testid="doctor-answer-close-btn"><X className="h-4 w-4" /></button>
    </div>
    <p className="whitespace-pre-line text-sm" data-testid="doctor-answer-text">{answer}</p>
    {left !== null && <span className="text-xs text-[var(--muted)]" data-testid="doctor-asks-left">{left} Magic generations left (free today + bought)</span>}
  </div>
);

export const DoctorAsk = ({ kitName, kit, adults, children, online, locked, onUpgrade }) => {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState({ busy: false, error: "", answer: "", left: null });

  const ask = () => {
    if (locked) { onUpgrade(); return; }
    if (!question.trim()) { setState((s) => ({ ...s, error: "Type a question for the Magic Marine Doctor first" })); return; }
    if (!online) { setState((s) => ({ ...s, error: "The Magic Marine Doctor needs a signal. In an emergency call Mayday on VHF 16." })); return; }
    setState({ busy: true, error: "", answer: "", left: null });
    api.post("/ai/doctor-ask", { question: question.trim(), kit_name: kitName, kit: kit.slice(0, 150), adults, children }, { timeout: 90000 })
      .then(({ data }) => setState((s) => ({ ...s, busy: false, answer: data.answer, left: data.asks_left })))
      .catch((e) => setState((s) => ({ ...s, busy: false, error: apiError(e, "The Magic Marine Doctor couldn't answer right now. In an emergency call Mayday on VHF 16.") })));
  };

  return (
    <div className="flex flex-col gap-2" data-testid="doctor-ask-panel">
      <label htmlFor="doctor-question" className="field-label">ASK THE MAGIC MARINE DOCTOR</label>
      <p className="-mt-1 text-xs italic text-[var(--muted)]" data-testid="doctor-caveat">(The MMD does not hold an M.D. but can help in an emergency)</p>
      <div className="flex items-start gap-2">
        <textarea id="doctor-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1024} rows={question ? 3 : 1} style={{ height: question ? 84 : 44, paddingTop: 10, paddingBottom: 6 }}
          placeholder="e.g. a crew member has a deep cut on their hand" className="field-input min-w-0 flex-1 resize-none leading-snug placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap" data-testid="doctor-question-input" />
        <button type="button" className="btn-solid h-11 shrink-0 px-4" onClick={ask} disabled={state.busy} data-testid="doctor-ask-btn">
          {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask..."}
        </button>
      </div>
      {state.busy && <p className="flex items-center gap-2 text-sm font-semibold" data-testid="doctor-loading"><Loader2 className="h-4 w-4 animate-spin" /> The Magic Marine Doctor is thinking...</p>}
      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="doctor-error">{state.error}</p>}
      {state.answer && <AnswerCard answer={state.answer} left={state.left} onClose={() => setState((s) => ({ ...s, answer: "" }))} />}
    </div>
  );
};
