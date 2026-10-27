import { useState } from "react";
import { Loader2, Wrench, X } from "lucide-react";
import { api, apiError } from "@/lib/api";

const historyLines = (entries) => entries.slice(0, 8).map((e) => [
  `${e.date}: ${e.hours} hrs`, e.engine_type && `(${e.engine_type})`, e.items?.length && `did ${e.items.join(", ")}`, e.notes && `notes: ${e.notes}`,
].filter(Boolean).join(" ").slice(0, 600));

const TypeWarning = ({ onAddType, onAskAnyway }) => (
  <div role="alert" className="flex flex-col gap-2 rounded-md border-[1.5px] border-amber-400 bg-amber-50 px-3 py-2 text-sm" data-testid="engineer-type-warning">
    <p className="font-semibold">Engine Type is blank. The Magic Marine Engineer uses it to give a better answer.</p>
    <div className="flex gap-2">
      <button type="button" className="btn-ghost h-9 flex-1 justify-center px-3 text-xs" onClick={onAddType} data-testid="engineer-add-type-btn">Add engine type</button>
      <button type="button" className="btn-solid h-9 flex-1 justify-center px-3 text-xs" onClick={onAskAnyway} data-testid="engineer-ask-anyway-btn">Ask anyway</button>
    </div>
  </div>
);

const AnswerCard = ({ answer, left, onAddToNotes, onClose }) => (
  <div className="flex flex-col gap-2 rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] px-3 py-2" data-testid="engineer-answer-card">
    <div className="flex items-center gap-2">
      <span className="flex flex-1 items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide"><Wrench className="h-4 w-4" /> The Magic Marine Engineer says</span>
      <button type="button" className="icon-btn h-8 w-8" aria-label="Close answer" onClick={onClose} data-testid="engineer-answer-close-btn"><X className="h-4 w-4" /></button>
    </div>
    <p className="whitespace-pre-line text-sm" data-testid="engineer-answer-text">{answer}</p>
    <div className="flex items-center gap-2">
      <button type="button" className="btn-ghost h-9 px-3 text-xs" onClick={onAddToNotes} data-testid="engineer-add-to-notes-btn">Add to Notes</button>
      {left !== null && <span className="text-xs text-[var(--muted)]" data-testid="engineer-asks-left">{left} questions left today</span>}
    </div>
  </div>
);

export const EngineerAsk = ({ engineType, entries, online, locked, onUpgrade, onFocusType, onAddToNotes }) => {
  const [question, setQuestion] = useState("");
  const [warning, setWarning] = useState(false);
  const [state, setState] = useState({ busy: false, error: "", answer: "", asked: "", left: null });

  const send = () => {
    setWarning(false);
    setState({ busy: true, error: "", answer: "", asked: question.trim(), left: null });
    api.post("/ai/engine-ask", { question: question.trim(), engine_type: engineType.trim(), history: historyLines(entries) }, { timeout: 90000 })
      .then(({ data }) => setState((s) => ({ ...s, busy: false, answer: data.answer, left: data.asks_left })))
      .catch((e) => setState((s) => ({ ...s, busy: false, error: apiError(e, "The Magic Marine Engineer couldn't answer right now. Please try again.") })));
  };
  const ask = () => {
    if (locked) { onUpgrade(); return; }
    if (!question.trim()) { setState((s) => ({ ...s, error: "Type a question for the Magic Marine Engineer first" })); return; }
    if (!online) { setState((s) => ({ ...s, error: "The Magic Marine Engineer needs a signal" })); return; }
    if (!engineType.trim()) { setWarning(true); return; }
    send();
  };
  const addToNotes = () => onAddToNotes(`Magic Marine Engineer - Q: ${state.asked} A: ${state.answer}`.replace(/\s+/g, " "));

  return (
    <div className="col-span-2 flex flex-col gap-2" data-testid="engineer-ask-panel">
      <label htmlFor="engineer-question" className="field-label">ASK THE MAGIC MARINE ENGINEER</label>
      <div className="flex items-start gap-2">
        <textarea id="engineer-question" value={question} onChange={(e) => { setQuestion(e.target.value); setWarning(false); }} maxLength={1024} rows={question ? 3 : 1} style={{ height: question ? 84 : 44, paddingTop: 10, paddingBottom: 6 }}
          placeholder="e.g. the engine is making a rattling sound" className="field-input min-w-0 flex-1 resize-none leading-snug placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap" data-testid="engineer-question-input" />
        <button type="button" className="btn-solid h-11 shrink-0 px-4" onClick={ask} disabled={state.busy} data-testid="engineer-ask-btn">
          {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask..."}
        </button>
      </div>
      {warning && <TypeWarning onAddType={() => { setWarning(false); onFocusType(); }} onAskAnyway={send} />}
      {state.busy && <p className="flex items-center gap-2 text-sm font-semibold" data-testid="engineer-loading"><Loader2 className="h-4 w-4 animate-spin" /> The Magic Marine Engineer is thinking...</p>}
      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="engineer-error">{state.error}</p>}
      {state.answer && <AnswerCard answer={state.answer} left={state.left} onAddToNotes={addToNotes} onClose={() => setState((s) => ({ ...s, answer: "" }))} />}
    </div>
  );
};
