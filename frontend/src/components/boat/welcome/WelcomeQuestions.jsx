import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Home, X } from "lucide-react";
import { glow } from "@/lib/glow";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// "I am interested" in finding things: what happens after Welcome, before the question folds.
const FindNoteDialog = ({ open, onContinue }) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onContinue(); }}>
    <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" guard={false} data-testid="welcome-find-note">
      <DialogHeader>
        <DialogTitle className="font-display text-lg font-extrabold text-[var(--navy)]">Finding things on your boat</DialogTitle>
        <DialogDescription className="text-sm text-[var(--ink)]">At the end of the Welcome page, My Boat Prep will open Boat Inventory and guide you through creating your zones like Cockpit and Galley, help you create your first cupboard, and even a box in that cupboard.</DialogDescription>
      </DialogHeader>
      <button type="button" className="btn-solid h-11 justify-center" onClick={onContinue} data-testid="welcome-find-note-continue-btn">Continue with Welcome...</button>
    </DialogContent>
  </Dialog>
);

const MV = "Admin - Model Vessel - ";
// What an "I am interested" answer recommends: Model Vessel tutorials, and a home list if none is recommended yet.
const RECOMMEND = {
  find: { tutorials: ["Basic Introduction Walkthrough", "Magic Scanning", "Batch Magic Scanning"], home: ["boatInventory", "Boat Inventory"] },
  crew: { tutorials: ["Crew Safety Briefings", "Crew Registration and Invites"], home: ["routeHazards", "Trip Planning"] },
  trip: { tutorials: ["Crew Safety Briefings", "Crew Registration and Invites"], home: ["routeHazards", "Trip Planning"] },
};
export const recommendations = (questions, answers) => {
  const yes = questions.filter((q) => answers[q.key] === "yes" && RECOMMEND[q.key]).map((q) => RECOMMEND[q.key]);
  return { tutorials: [...new Set(yes.flatMap((r) => r.tutorials))], home: yes[0]?.home || null };
};

const Choice = ({ on, label, onPick, testId }) => (
  <label className={`flex flex-1 cursor-pointer items-center gap-2 rounded-md border-[1.5px] px-3 py-2 text-sm font-bold ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white"}`} data-testid={testId}>
    <input type="checkbox" checked={on} onChange={onPick} className="h-5 w-5 accent-[var(--navy)]" data-testid={`${testId}-checkbox`} />{label}
  </label>
);

// One question; once answered it folds, green (interested) or light red.
// A new question: the bold title of the one just answered (folded) glows 5s, then this one's title 5s, then its bullets go grey one by one.
const Question = ({ q, answer, onAnswer, focus, onOpen, prevKey, beforeYes }) => {
  const [open, setOpen] = useState(!answer || focus);
  const ran = useRef(false);
  useEffect(() => {
    if (answer || ran.current) return;
    ran.current = true;
    (async () => {
      if (prevKey) await glow(`welcome-q-${prevKey}-toggle`, 5000);
      await glow(`welcome-q-${q.key}-toggle`, 5000);
      for (let i = 0; i < q.bullets.length; i += 1) await glow(`welcome-${q.key}-bullet-${i}`, 5000, "mbp-glow-soft");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = async (v) => { if (v === "yes" && beforeYes) await beforeYes(); onAnswer(v); setOpen(false); };
  const tone = answer === "yes" ? "border-emerald-600 bg-emerald-50" : answer === "no" ? "border-red-300 bg-red-50" : "border-[var(--navy)] bg-white";
  return (
    <div className={`flex flex-col gap-2 rounded-md border-[1.5px] p-3 ${tone}`} data-testid={`welcome-q-${q.key}`}>
      <button type="button" onClick={() => { if (!open) onOpen(); setOpen((o) => !o); }} className="flex items-start gap-2 text-left text-sm font-extrabold" aria-expanded={open} data-testid={`welcome-q-${q.key}-toggle`}>
        {answer === "yes" ? <Check className="h-5 w-5 shrink-0 text-emerald-700" /> : answer === "no" ? <X className="h-5 w-5 shrink-0 text-red-700" /> : null}
        <span className="flex-1">{q.text}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <>
        {q.notes.map((n) => <p key={n} className="text-xs text-[var(--muted)]">{n}</p>)}
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {q.bullets.map((b, i) => <li key={b} className="rounded px-1" data-testid={`welcome-${q.key}-bullet-${i}`}>{b}</li>)}
        </ul>
        <div className="flex gap-2">
          <Choice on={answer === "yes"} label="I am interested" onPick={() => pick("yes")} testId={`welcome-q-${q.key}-yes`} />
          <Choice on={answer === "no"} label="I am not interested" onPick={() => pick("no")} testId={`welcome-q-${q.key}-no`} />
        </div>
      </>}
    </div>
  );
};

// The questions one at a time (the next shows once this one is answered), then what we recommend.
export const WelcomeQuestions = ({ questions, answers, onAnswer, homeId, onMakeHome, focus, onOpen, onTutorial }) => {
  const next = questions.findIndex((q) => !answers[q.key]);
  const shown = next < 0 ? questions : questions.slice(0, next + 1);
  const rec = recommendations(questions, answers);
  const [justAnswered, setJustAnswered] = useState(null);
  const [findNote, setFindNote] = useState(null);
  return (
    <section className="flex flex-col gap-3" data-testid="welcome-questions">
      <p className="text-sm">My Boat Prep would like to know what you would like from it, so we don&apos;t clutter up your session with features you have no interest in. You can always turn them on later: when getting started, less is more.</p>
      {shown.map((q) => <Question key={q.key} q={q} answer={answers[q.key]} onAnswer={(v) => { setJustAnswered(q.key); onAnswer(q.key, v); }} focus={focus === q.key} onOpen={() => onOpen(q.key)} prevKey={justAnswered}
        beforeYes={q.key === "find" ? () => new Promise((done) => setFindNote(() => done)) : undefined} />)}
      <FindNoteDialog open={!!findNote} onContinue={() => { findNote(); setFindNote(null); }} />
      {(rec.tutorials.length > 0 || rec.home) && (
        <div className="flex flex-col gap-2 rounded-md border-[1.5px] border-emerald-600 bg-white p-3" data-testid="welcome-recommend">
          <p className="text-sm font-extrabold uppercase tracking-wide">Recommended for you</p>
          {rec.tutorials.length > 0 && <>
            <p className="text-sm">Model Vessel tutorials to take (tap one to switch to the Model Vessel and start it):</p>
            <ul className="list-disc pl-5 text-sm" data-testid="welcome-recommend-tutorials">{rec.tutorials.map((t) => (
              <li key={t} title={MV + t}><button type="button" onClick={() => onTutorial(t)} className="text-left font-bold text-[var(--navy)] underline underline-offset-2 hover:text-[var(--blue)]"
                data-testid={`welcome-tutorial-${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{t}</button></li>
            ))}</ul>
          </>}
          {rec.home && (rec.home[0] === homeId
            ? <p className="text-sm font-bold text-emerald-700" data-testid="welcome-recommend-home-done">{rec.home[1]} is your home list.</p>
            : <button type="button" className="btn-solid h-11 justify-center" onClick={() => onMakeHome(rec.home[0])} data-testid="welcome-make-home-btn"><Home className="h-4 w-4" />Make {rec.home[1]} my home</button>)}
        </div>
      )}
    </section>
  );
};
