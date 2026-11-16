import { ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, GraduationCap, Lightbulb, Pencil, Trophy, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { linkedWizard } from "@/lib/wizard";

const SHELL = "pointer-events-auto fixed inset-x-0 bottom-0 z-[70] border-t-4 border-emerald-600 bg-white print:hidden";

const FinishLine = ({ f, n, wizards, onOpen, t }) => {
  if (f.kind === "tick") return <p className="flex items-start gap-2 pl-1" data-testid={`${t}-finish-tick-${n}`}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />{f.text}</p>;
  if (f.kind === "idea") return <p className="mt-1 flex items-start gap-2 font-semibold text-amber-900" data-testid={`${t}-finish-idea-${n}`}><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 fill-amber-200 text-amber-600" />{f.text}</p>;
  if (f.kind === "link") {
    const w = linkedWizard(wizards, f.text);
    return w
      ? <button type="button" onClick={() => onOpen(w)} className="flex items-center gap-1.5 self-start pl-7 text-left font-bold text-emerald-800 underline underline-offset-2" data-testid={`${t}-finish-link-${n}`}><ArrowRight className="h-4 w-4 shrink-0" />{f.text}</button>
      : <p className="pl-7 text-sm text-[var(--muted)]" data-testid={`${t}-finish-link-missing-${n}`}>{f.text} (no walkthrough with this name)</p>;
  }
  return <p className="font-extrabold" data-testid={`${t}-finish-heading-${n}`}>{f.text}</p>;
};

// The last panel, half the screen: "--" bold, "---" ticked, "$$" ideas and "$$$" links to other walkthroughs, then Finish.
const FinishPanel = ({ title, finish, onBack, onClose, onFinish, wizards, onOpen, t }) => (
  <section data-training-window className={`${SHELL} flex max-h-[85vh] min-h-[max(50vh,260px)] flex-col gap-3 px-4 pb-3 pt-2 shadow-[0_-8px_24px_rgba(6,78,59,0.25)]`} role="dialog" aria-label={`${title} finished`} data-testid={`${t}-finish-panel`}>
    <div className="flex items-center gap-2">
      <Trophy className="h-5 w-5 shrink-0 text-emerald-700" />
      <h2 className="flex-1 font-display text-sm font-extrabold uppercase tracking-wide text-emerald-800" data-testid={`${t}-finish-title`}>{title} · Well done</h2>
      <button type="button" onClick={onClose} className="icon-btn" aria-label="Close training" data-testid={`${t}-finish-close-btn`}><X className="h-5 w-5" /></button>
    </div>
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-[15px] leading-snug text-[var(--navy)]" data-testid={`${t}-finish-list`}>
      {finish.length ? finish.map((f, n) => <FinishLine key={n} f={f} n={n} wizards={wizards} onOpen={onOpen} t={t} />)
        : <p className="font-extrabold" data-testid={`${t}-finish-heading-0`}>You have finished the walkthrough.</p>}
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={onBack} className="btn-ghost h-11 flex-1 justify-center gap-1" data-testid={`${t}-finish-back-btn`}><ChevronLeft className="h-4 w-4" /> Back</button>
      <button type="button" onClick={onFinish} className="btn-solid h-11 flex-1 justify-center gap-1 !bg-emerald-700" data-testid={`${t}-finish-btn`}><Check className="h-4 w-4" /> Finish</button>
    </div>
  </section>
);

const MiniBar = ({ steps, at, onGo, onShrink, t }) => (
  <section data-training-window className={`${SHELL} flex h-12 items-center gap-1 pl-3 pr-1 shadow-[0_-6px_18px_rgba(6,78,59,0.25)]`} role="dialog" aria-label="Model Vessel training" data-testid={`${t}-window-mini`}>
    <button type="button" onClick={() => onShrink(false)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Show the training steps" data-testid={`${t}-expand-btn`}>
      <GraduationCap className="h-5 w-5 shrink-0 text-emerald-700" />
      <span className="shrink-0 text-xs font-extrabold uppercase text-emerald-800" data-testid={`${t}-mini-count`}>{at + 1}/{steps.length}</span>
      <span className="truncate text-sm text-[var(--navy)]" data-testid={`${t}-mini-text`}>{steps[at]}</span>
      <ChevronsUp className="h-5 w-5 shrink-0 text-emerald-700" />
    </button>
    <button type="button" onClick={() => onGo(at - 1)} disabled={at === 0} className="icon-btn disabled:opacity-30" aria-label="Back" data-testid={`${t}-mini-back-btn`}><ChevronLeft className="h-5 w-5" /></button>
    <button type="button" onClick={() => onGo(at + 1)} className="icon-btn text-emerald-700" aria-label="Next" data-testid={`${t}-mini-next-btn`}><ChevronRight className="h-5 w-5" /></button>
  </section>
);

// One wizard on screen: a quarter-screen step window (20% taller when a step's text needs a scroll bar) (or a one-line bar), then the Finish panel after the last step.
export const WizardWindow = ({ title = "Training", steps, finish, at, mini, onGo, onShrink, onClose, onFinish, wizards = [], onOpen, onEdit, t = "training" }) => {
  const text = useRef(null);
  const [tallAt, setTallAt] = useState(null);
  const key = `${at}|${steps[at] || ""}`;
  const tall = tallAt === key && !mini && at < steps.length;
  // Measured at the normal height for each step; only a step that overflows gets the taller window.
  useLayoutEffect(() => {
    const el = text.current;
    if (el && tallAt !== key && el.scrollHeight > el.clientHeight + 1) setTallAt(key);
  }, [key, mini, tallAt]);
  useEffect(() => {
    if (t !== "training") return undefined;
    document.body.classList.toggle("training-tall", tall);
    return () => document.body.classList.remove("training-tall");
  }, [tall, t]);
  if (at >= steps.length) return <FinishPanel title={title} finish={finish} onBack={() => onGo(steps.length - 1)} onClose={onClose} onFinish={onFinish} wizards={wizards} onOpen={onOpen} t={t} />;
  if (mini) return <MiniBar steps={steps} at={at} onGo={onGo} onShrink={onShrink} t={t} />;
  return (
    <section data-training-window className={`${SHELL} flex ${tall ? "h-[30vh] min-h-[204px]" : "h-[25vh] min-h-[170px]"} flex-col gap-2 px-4 pb-3 pt-2 shadow-[0_-8px_24px_rgba(6,78,59,0.25)]`} role="dialog" aria-label="Model Vessel training" data-testid={`${t}-window`}>
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 shrink-0 text-emerald-700" />
        <h2 className="flex min-w-0 flex-1 font-display text-sm font-extrabold uppercase tracking-wide text-emerald-800" data-testid={`${t}-step-count`}><span className="truncate">{title}</span><span className="shrink-0 whitespace-pre"> · Step {at + 1} of {steps.length}</span></h2>
        {onEdit && <button type="button" onClick={onEdit} className="btn-ghost h-9 min-h-0 shrink-0 gap-1 border-emerald-700 px-2.5 text-xs font-bold text-emerald-800" data-testid={`${t}-edit-step-btn`}><Pencil className="h-3.5 w-3.5" /> Edit Step</button>}
        <button type="button" onClick={() => onShrink(true)} className="icon-btn" aria-label="Shrink to one line" title="Shrink to one line" data-testid={`${t}-shrink-btn`}><ChevronsDown className="h-5 w-5" /></button>
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Close training" data-testid={`${t}-close-btn`}><X className="h-5 w-5" /></button>
      </div>
      <p ref={text} className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-[15px] leading-snug text-[var(--navy)]" data-testid={`${t}-step-text`}>{steps[at]}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => onGo(at - 1)} disabled={at === 0} className="btn-ghost h-11 flex-1 justify-center gap-1 disabled:opacity-40" data-testid={`${t}-back-btn`}><ChevronLeft className="h-4 w-4" /> Back</button>
        <button type="button" onClick={() => onGo(at + 1)} className="btn-solid h-11 flex-1 justify-center gap-1 !bg-emerald-700" data-testid={`${t}-next-btn`}>Next <ChevronRight className="h-4 w-4" /></button>
      </div>
    </section>
  );
};
