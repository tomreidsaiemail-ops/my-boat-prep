import { ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, CircleHelp, GraduationCap, Lightbulb, Pencil, Trophy, Wand2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { doItForMe } from "@/lib/doItForMe";
import { finishFor, linkedWizard, nextPanel } from "@/lib/wizard";
import { highlightNames } from "@/lib/highlight";
import { NamePicker } from "@/components/boat/training/NamePicker";

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
const FinishPanel = ({ title, finish, onBack, onClose, onFinish, wizards, onOpen, onEditFinish, t }) => (
  <section data-training-window className={`${SHELL} flex max-h-[85vh] min-h-[max(50vh,260px)] flex-col gap-3 px-4 pb-3 pt-2 shadow-[0_-8px_24px_rgba(6,78,59,0.25)]`} role="dialog" aria-label={`${title} finished`} data-testid={`${t}-finish-panel`}>
    <div className="flex items-center gap-2">
      <Trophy className="h-5 w-5 shrink-0 text-emerald-700" />
      <h2 className="flex-1 font-display text-sm font-extrabold uppercase tracking-wide text-emerald-800" data-testid={`${t}-finish-title`}>{title} · Well done</h2>
      {onEditFinish && <button type="button" onClick={onEditFinish} className="btn-ghost h-9 min-h-0 shrink-0 gap-1 border-emerald-700 px-2.5 text-xs font-bold text-emerald-800" data-testid={`${t}-edit-finish-btn`}><Pencil className="h-3.5 w-3.5" /> Edit Final</button>}
      <button type="button" onClick={onClose} className="icon-btn" aria-label="Close training" data-testid={`${t}-finish-close-btn`}><X className="h-5 w-5" /></button>
    </div>
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-[15px] leading-snug text-[var(--navy)]" data-testid={`${t}-finish-list`}>
      {finish.some((f) => f.kind !== "para") ? finish.map((f, n) => f.kind !== "para" && <FinishLine key={n} f={f} n={n} wizards={wizards} onOpen={onOpen} t={t} />)
        : <p className="font-extrabold" data-testid={`${t}-finish-heading-0`}>You have finished the walkthrough.</p>}
      {/* "%%" lines: closing paragraphs, always at the bottom after the links. */}
      {finish.some((f) => f.kind === "para") && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 italic text-emerald-950" data-testid={`${t}-finish-paras`}>
          {finish.map((f, n) => f.kind === "para" && <p key={n} data-testid={`${t}-finish-para-${n}`}>{f.text}</p>)}
        </div>
      )}
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={onBack} className="btn-ghost h-11 flex-1 justify-center gap-1" data-testid={`${t}-finish-back-btn`}><ChevronLeft className="h-4 w-4" /> Back</button>
      <button type="button" onClick={onFinish} className="btn-solid h-11 flex-1 justify-center gap-1 !bg-emerald-700" data-testid={`${t}-finish-btn`}><Check className="h-4 w-4" /> Finish</button>
    </div>
  </section>
);

const MiniBar = ({ steps, at, onBack, onNext, asking, onShrink, t }) => (
  <section data-training-window className={`${SHELL} flex h-12 items-center gap-1 pl-3 pr-1 shadow-[0_-6px_18px_rgba(6,78,59,0.25)]`} role="dialog" aria-label="Model Vessel training" data-testid={`${t}-window-mini`}>
    <button type="button" onClick={() => onShrink(false)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Show the training steps" data-testid={`${t}-expand-btn`}>
      <GraduationCap className="h-5 w-5 shrink-0 text-emerald-700" />
      <span className="shrink-0 text-xs font-extrabold uppercase text-emerald-800" data-testid={`${t}-mini-count`}>{at + 1}/{steps.length}</span>
      <span className="truncate text-sm text-[var(--navy)]" data-testid={`${t}-mini-text`}>{steps[at]}</span>
      <ChevronsUp className="h-5 w-5 shrink-0 text-emerald-700" />
    </button>
    <button type="button" onClick={onBack} disabled={at === 0} className="icon-btn disabled:opacity-30" aria-label="Back" data-testid={`${t}-mini-back-btn`}><ChevronLeft className="h-5 w-5" /></button>
    <button type="button" onClick={asking ? () => onShrink(false) : onNext} className="icon-btn text-emerald-700" aria-label={asking ? "Answer the question" : "Next"} data-testid={`${t}-mini-next-btn`}><ChevronRight className="h-5 w-5" /></button>
  </section>
);

const list = (keys) => keys.join(keys.length > 2 ? ", " : " and ").replace(/, ([^,]*)$/, " and $1");
const DoItForMe = ({ fill, t }) => {
  // Shown at the top so they don't cover the wizard's Next button.
  const run = async () => {
    const { done, missing } = await doItForMe(fill);
    if (done.length) toast.success(`Filled in ${list(done)}`, { position: "top-center" });
    if (missing.length) toast.error(`Couldn't find ${list(missing)} on screen. Open that part of the app, then tap Do it for me again.`, { duration: 7000, position: "top-center" });
  };
  return (
    <button type="button" onClick={run} aria-label="Do it for me" className="flex h-9 min-h-0 shrink-0 items-center gap-1 rounded-full border-2 border-amber-500 bg-amber-100 px-2.5 text-xs font-extrabold text-amber-900 shadow-sm hover:bg-amber-200 active:scale-95 [transition:background-color_.15s,transform_.1s]" data-testid={`${t}-do-it-btn`}>
      <Wand2 className="h-3.5 w-3.5" /><span className="whitespace-nowrap">Do it<span className="hidden sm:inline"> for me</span></span>
    </button>
  );
};

// Two answers sit beside Back; more are listed one per row (two per row on wider screens).
const Answers = ({ q, onBack, at, onAnswer, t }) => {
  const many = q.answers.length > 2;
  const back = <button type="button" onClick={onBack} disabled={at === 0} className={`btn-ghost h-11 justify-center gap-1 px-3 disabled:opacity-40 ${many ? "" : "flex-1"}`} data-testid={`${t}-back-btn`}><ChevronLeft className="h-4 w-4" /> Back</button>;
  const buttons = q.answers.map((a, n) => (
    <button key={n} type="button" onClick={() => onAnswer(a)} className="btn-solid min-h-11 flex-1 justify-center !bg-emerald-700 px-3 py-2 text-center" data-testid={`${t}-answer-${n}`}>{a}</button>
  ));
  return many ? (
    <div className="flex flex-col gap-2" data-testid={`${t}-answers`}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{buttons}</div>
      <div className="flex">{back}</div>
    </div>
  ) : <div className="flex gap-2" data-testid={`${t}-answers`}>{back}{buttons}</div>;
};

// One wizard on screen: a quarter-screen step window (20% taller when a step's text needs a scroll bar) (or a one-line bar), then the Finish panel after the last step.
// Question panels show one button per answer; Next, answers and "???" jumps go through nextPanel, Back retraces the path taken.
// onAddHighlight (admin): the "?" button names a thing on screen and can add "!!-!!Highlight <name>" to this step.
export const WizardWindow = ({ title = "Training", wiz, at, path = [], answers = {}, mini, onMove, onShrink, onClose, onFinish, wizards = [], onOpen, onEdit, onEditFinish, onAddHighlight, t = "training" }) => {
  const { steps } = wiz;
  const next = (ans = answers) => onMove(nextPanel(wiz, at, ans), [...path, at], ans);
  const back = () => (path.length ? onMove(path[path.length - 1], path.slice(0, -1), answers) : onMove(Math.max(0, at - 1), [], answers));
  const q = wiz.question[at];
  const rich = wiz.rich[at];
  const fill = wiz.fill[at];
  const text = useRef(null);
  const [tallAt, setTallAt] = useState(null);
  const [picking, setPicking] = useState(false);
  const lit = (wiz.highlight?.[at] || []).join("|");
  useEffect(() => highlightNames(lit ? lit.split("|") : []), [lit, at]);
  useEffect(() => setPicking(false), [at]);
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
  if (at >= steps.length) return <FinishPanel title={title} finish={finishFor(wiz.finish, answers)} onBack={back} onClose={onClose} onFinish={onFinish} wizards={wizards} onOpen={onOpen} onEditFinish={onEditFinish} t={t} />;
  if (mini) return <MiniBar steps={steps} at={at} onBack={back} onNext={() => next()} asking={!!q} onShrink={onShrink} t={t} />;
  return (
    <section data-training-window className={`${SHELL} flex ${q?.answers.length > 2 || rich || picking ? "max-h-[75vh] min-h-[170px]" : tall ? "h-[30vh] min-h-[204px]" : "h-[25vh] min-h-[170px]"} flex-col gap-2 px-4 pb-3 pt-2 shadow-[0_-8px_24px_rgba(6,78,59,0.25)]`} role="dialog" aria-label="Model Vessel training" data-testid={`${t}-window`}>
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 shrink-0 text-emerald-700" />
        <h2 className="flex min-w-0 font-display text-sm font-extrabold uppercase tracking-wide text-emerald-800" data-testid={`${t}-step-count`}><span className="truncate">{title}</span><span className="shrink-0 whitespace-pre"> · Step {at + 1} of {steps.length}</span></h2>
        {fill?.length > 0 && <DoItForMe fill={fill} t={t} />}
        <span className="flex-1" />
        {onAddHighlight && !rich && <button type="button" onClick={() => setPicking(true)} className="icon-btn text-emerald-800" aria-label="Name a button for !!-!!Highlight" title="Tap, then tap a button or box to get its name" data-testid={`${t}-name-pick-btn`}><CircleHelp className="h-5 w-5" /></button>}
        {onEdit && !rich && <button type="button" onClick={onEdit} className="btn-ghost h-9 min-h-0 shrink-0 gap-1 border-emerald-700 px-2.5 text-xs font-bold text-emerald-800" aria-label="Edit Step" data-testid={`${t}-edit-step-btn`}><Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit Step</span></button>}
        <button type="button" onClick={() => onShrink(true)} className="icon-btn" aria-label="Shrink to one line" title="Shrink to one line" data-testid={`${t}-shrink-btn`}><ChevronsDown className="h-5 w-5" /></button>
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Close training" data-testid={`${t}-close-btn`}><X className="h-5 w-5" /></button>
      </div>
      {picking && <NamePicker onAdd={onAddHighlight} onClose={() => setPicking(false)} t={t} />}
      {rich ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-[15px] leading-snug text-[var(--navy)]" data-testid={`${t}-step-ideas`}>
          {finishFor(rich, answers).map((f, n) => <FinishLine key={n} f={f} n={n} wizards={wizards} onOpen={onOpen} t={`${t}-step`} />)}
        </div>
      ) : <p ref={text} className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-[15px] leading-snug text-[var(--navy)]" data-testid={`${t}-step-text`}>{steps[at]}</p>}
      {q ? <Answers q={q} at={at} onBack={back} onAnswer={(a) => next({ ...answers, [q.q]: a })} t={t} /> : (
        <div className="flex gap-2">
          <button type="button" onClick={back} disabled={at === 0} className="btn-ghost h-11 flex-1 justify-center gap-1 disabled:opacity-40" data-testid={`${t}-back-btn`}><ChevronLeft className="h-4 w-4" /> Back</button>
          <button type="button" onClick={() => next()} className="btn-solid h-11 flex-1 justify-center gap-1 !bg-emerald-700" data-testid={`${t}-next-btn`}>Next <ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
};
