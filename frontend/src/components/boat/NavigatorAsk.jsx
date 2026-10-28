import { useRef, useState } from "react";
import { Compass, Loader2, X } from "lucide-react";
import { api, apiError } from "@/lib/api";

const routeText = (start, dest) => [start.trim(), dest.trim()].filter(Boolean).join(" to ");

const AnswerCard = ({ answer, left, onClose }) => (
  <div className="flex flex-col gap-2 rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] px-3 py-2" data-testid="navigator-answer-card">
    <div className="flex items-center gap-2">
      <span className="flex flex-1 items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide"><Compass className="h-4 w-4" /> The Magic Marine Navigator suggests</span>
      <button type="button" className="icon-btn h-8 w-8" aria-label="Close answer" onClick={onClose} data-testid="navigator-answer-close-btn"><X className="h-4 w-4" /></button>
    </div>
    <p className="whitespace-pre-line text-sm" data-testid="navigator-answer-text">{answer}</p>
    {left !== null && <span className="text-xs text-[var(--muted)]" data-testid="navigator-asks-left">{left} questions left today</span>}
  </div>
);

const RouteField = ({ id, label, value, onChange, placeholder }) => (
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <label htmlFor={id} className="field-label">{label}</label>
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} placeholder={placeholder}
      className="field-input text-base normal-case tracking-normal" data-testid={`${id}-input`} />
  </div>
);

export const NavigatorAsk = ({ boat, onChange, items, online, locked, onUpgrade }) => {
  const start = boat.route_start || "";
  const dest = boat.route_dest || "";
  const auto = useRef(routeText(start, dest));
  const [question, setQuestion] = useState(auto.current);
  const [state, setState] = useState({ busy: false, error: "", answer: "", left: null });

  // Keep the route at the front of the question, leaving anything the skipper added after it.
  const setRoute = (key, value) => {
    onChange(key, value);
    const next = routeText(key === "route_start" ? value : start, key === "route_dest" ? value : dest);
    setQuestion((q) => (q.startsWith(auto.current) ? next + q.slice(auto.current.length) : q || next).slice(0, 1024));
    auto.current = next;
    setState((s) => ({ ...s, error: "" }));
  };

  const ask = () => {
    if (locked) { onUpgrade(); return; }
    if (!start.trim() || !dest.trim()) { setState((s) => ({ ...s, error: "Add a START and a DESTINATION first. The Magic Marine Navigator needs both to suggest a route." })); return; }
    if (!online) { setState((s) => ({ ...s, error: "The Magic Marine Navigator needs a signal" })); return; }
    setState({ busy: true, error: "", answer: "", left: null });
    const details = { boat_type: boat.boat_type, units: boat.units, loa: boat.loa, beam: boat.beam, draft: boat.draft, mast_height: boat.mast_height,
      pob: boat.pob, children: boat.children, trip_days: boat.trip_days };
    api.post("/ai/navigator-ask", { question: question.trim(), start: start.trim(), destination: dest.trim(), boat: details, items: items.slice(0, 150) }, { timeout: 90000 })
      .then(({ data }) => setState((s) => ({ ...s, busy: false, answer: data.answer, left: data.asks_left })))
      .catch((e) => setState((s) => ({ ...s, busy: false, error: apiError(e, "The Magic Marine Navigator couldn't answer right now. Please try again.") })));
  };

  return (
    <div className="flex flex-col gap-2" data-testid="navigator-ask-panel">
      <div className="flex gap-2">
        <RouteField id="route-start" label="START" value={start} onChange={(v) => setRoute("route_start", v)} placeholder="e.g. Mana" />
        <RouteField id="route-dest" label="DESTINATION" value={dest} onChange={(v) => setRoute("route_dest", v)} placeholder="e.g. Picton" />
      </div>
      <label htmlFor="navigator-question" className="field-label">ASK THE MAGIC MARINE NAVIGATOR</label>
      <div className="flex items-start gap-2">
        <textarea id="navigator-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1024} rows={question ? 3 : 1} style={{ height: question ? 84 : 44, paddingTop: 10, paddingBottom: 6 }}
          placeholder="e.g. Mana to Picton Via Queen Charlotte Sound" className="field-input min-w-0 flex-1 resize-none leading-snug placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap" data-testid="navigator-question-input" />
        <button type="button" className="btn-solid h-11 shrink-0 px-4" onClick={ask} disabled={state.busy} data-testid="navigator-ask-btn">
          {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask..."}
        </button>
      </div>
      {state.busy && <p className="flex items-center gap-2 text-sm font-semibold" data-testid="navigator-loading"><Loader2 className="h-4 w-4 animate-spin" /> The Magic Marine Navigator is plotting...</p>}
      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="navigator-error">{state.error}</p>}
      {state.answer && <AnswerCard answer={state.answer} left={state.left} onClose={() => setState((s) => ({ ...s, answer: "" }))} />}
    </div>
  );
};
