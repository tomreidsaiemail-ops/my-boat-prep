import { useState } from "react";
import { Loader2, PawPrint, Stethoscope, User, X } from "lucide-react";
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

// "A person" plus one button per pet; the Doctor tailors first aid to the one picked.
const WhoNeedsHelp = ({ pets, value, onChange }) => (
  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Who needs help?" data-testid="doctor-who">
    <span className="text-xs font-bold text-[var(--muted)]">Who needs help?</span>
    {[{ key: "", label: "A person", Icon: User }, ...pets.map((p, i) => ({ key: String(i), label: `${p.name?.trim() || "Pet"}${p.type?.trim() ? ` (${p.type.trim()})` : ""}`, Icon: PawPrint }))].map(({ key, label, Icon }) => (
      <button key={key || "person"} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)} data-testid={`doctor-who-${key === "" ? "person" : `pet-${key}`}`}
        className={`flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-sm font-bold [transition:background-color_.15s,color_.15s] ${value === key ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white"}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </button>
    ))}
  </div>
);

export const DoctorAsk = ({ kitName, kit, adults, children, pets = [], units = "kg", online, locked, onUpgrade }) => {
  const [question, setQuestion] = useState("");
  const [who, setWho] = useState(pets.length && /pet/i.test(kitName) ? "0" : "");
  const [state, setState] = useState({ busy: false, error: "", answer: "", left: null });
  const pet = who === "" ? null : pets[Number(who)];

  const ask = () => {
    if (locked) { onUpgrade(); return; }
    if (!question.trim()) { setState((s) => ({ ...s, error: "Type a question for the Magic Marine Doctor first" })); return; }
    if (!online) { setState((s) => ({ ...s, error: "The Magic Marine Doctor needs a signal. In an emergency call Mayday on VHF 16." })); return; }
    setState({ busy: true, error: "", answer: "", left: null });
    const forPet = pet ? { pet: { type: pet.type || "", name: pet.name || "", breed: pet.breed || "", weight: pet.weight || "" }, units } : {};
    api.post("/ai/doctor-ask", { question: question.trim(), kit_name: kitName, kit: kit.slice(0, 150), adults, children, ...forPet }, { timeout: 90000 })
      .then(({ data }) => setState((s) => ({ ...s, busy: false, answer: data.answer, left: data.asks_left })))
      .catch((e) => setState((s) => ({ ...s, busy: false, error: apiError(e, "The Magic Marine Doctor couldn't answer right now. In an emergency call Mayday on VHF 16.") })));
  };

  return (
    <div className="flex flex-col gap-2" data-testid="doctor-ask-panel">
      <label htmlFor="doctor-question" className="field-label">ASK THE MAGIC MARINE DOCTOR</label>
      <p className="-mt-1 text-xs italic text-[var(--muted)]" data-testid="doctor-caveat">(The MMD does not hold an M.D. but can help in an emergency)</p>
      {pets.length > 0 && <WhoNeedsHelp pets={pets} value={pet ? who : ""} onChange={setWho} />}
      <div className="flex items-start gap-2">
        <textarea id="doctor-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1024} rows={question ? 3 : 1} style={{ height: question ? 84 : 44, paddingTop: 10, paddingBottom: 6 }}
          placeholder={pet ? `e.g. ${pet.name?.trim() || "our pet"} has cut a paw on the deck` : "e.g. a crew member has a deep cut on their hand"} className="field-input min-w-0 flex-1 resize-none leading-snug placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap" data-testid="doctor-question-input" />
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
