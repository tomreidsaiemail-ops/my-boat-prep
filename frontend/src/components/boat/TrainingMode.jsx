import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, GraduationCap, X } from "lucide-react";
import useAdminLists from "@/hooks/useAdminLists";

const PREFIX = "Admin - Model Vessel";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

// Model Vessel: a green page with a Training Mode strip, and a floating window (a quarter of the screen) stepping through
// the "Admin - Model Vessel - wizard instructions" list. The step is remembered; X hides it until Show steps.
export const TrainingMode = ({ uid, online }) => {
  const steps = (useAdminLists(PREFIX, online).find((l) => /wizard instructions/i.test(l.name))?.items || []).map((i) => i.label);
  const stepKey = `mbp_model_step:${uid}`;
  const shutKey = `mbp_model_wizard_closed:${uid}`;
  const [step, setStep] = useState(() => read(stepKey, 0));
  const [shut, setShut] = useState(() => read(shutKey, false));
  // Shrunk to one line so the screen behind (e.g. Delete Zone) can be reached; tap the line to bring it back.
  const miniKey = `mbp_model_wizard_mini:${uid}`;
  const [mini, setMini] = useState(() => read(miniKey, false));
  const shrink = (v) => { setMini(v); localStorage.setItem(miniKey, JSON.stringify(v)); };
  const show = !shut && steps.length > 0;
  const at = Math.min(step, Math.max(steps.length - 1, 0));
  useEffect(() => {
    document.body.classList.add("training-mode");
    return () => document.body.classList.remove("training-mode");
  }, []);
  useEffect(() => {
    document.body.classList.toggle("training-open", show && !mini);
    document.body.classList.toggle("training-mini", show && mini);
    return () => document.body.classList.remove("training-open", "training-mini");
  }, [show, mini]);
  const go = (n) => { setStep(n); localStorage.setItem(stepKey, JSON.stringify(n)); };
  const close = (v) => { setShut(v); localStorage.setItem(shutKey, JSON.stringify(v)); };
  return (
    <>
      <div data-training-window className="pointer-events-auto sticky top-0 z-[70] flex items-center justify-center gap-2 bg-emerald-700 px-3 py-1.5 text-center text-xs font-extrabold uppercase tracking-wide text-white print:hidden" role="status" data-testid="training-mode-strip">
        <GraduationCap className="h-4 w-4 shrink-0" /> &ldquo;Model Vessel&rdquo; Training Mode
        {shut && steps.length > 0 && <button type="button" onClick={() => close(false)} className="ml-2 rounded-full bg-white px-2.5 py-0.5 text-[11px] text-emerald-800" data-testid="training-show-btn">Show steps</button>}
      </div>
      {show && mini && (
        <section data-training-window className="pointer-events-auto fixed inset-x-0 bottom-0 z-[70] flex h-12 items-center gap-1 border-t-4 border-emerald-600 bg-white pl-3 pr-1 shadow-[0_-6px_18px_rgba(6,78,59,0.25)] print:hidden" role="dialog" aria-label="Model Vessel training" data-testid="training-window-mini">
          <button type="button" onClick={() => shrink(false)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Show the training steps" data-testid="training-expand-btn">
            <GraduationCap className="h-5 w-5 shrink-0 text-emerald-700" />
            <span className="shrink-0 text-xs font-extrabold uppercase text-emerald-800" data-testid="training-mini-count">{at + 1}/{steps.length}</span>
            <span className="truncate text-sm text-[var(--navy)]" data-testid="training-mini-text">{steps[at]}</span>
            <ChevronsUp className="h-5 w-5 shrink-0 text-emerald-700" />
          </button>
          <button type="button" onClick={() => go(at - 1)} disabled={at === 0} className="icon-btn disabled:opacity-30" aria-label="Back" data-testid="training-mini-back-btn"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(at + 1)} disabled={at >= steps.length - 1} className="icon-btn text-emerald-700 disabled:opacity-30" aria-label="Next" data-testid="training-mini-next-btn"><ChevronRight className="h-5 w-5" /></button>
        </section>
      )}
      {show && !mini && (
        <section data-training-window className="pointer-events-auto fixed inset-x-0 bottom-0 z-[70] flex h-[25vh] min-h-[170px] flex-col gap-2 border-t-4 border-emerald-600 bg-white px-4 pb-3 pt-2 shadow-[0_-8px_24px_rgba(6,78,59,0.25)] print:hidden" role="dialog" aria-label="Model Vessel training" data-testid="training-window">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 shrink-0 text-emerald-700" />
            <h2 className="flex-1 font-display text-sm font-extrabold uppercase tracking-wide text-emerald-800" data-testid="training-step-count">Training · Step {at + 1} of {steps.length}</h2>
            <button type="button" onClick={() => shrink(true)} className="icon-btn" aria-label="Shrink to one line" title="Shrink to one line" data-testid="training-shrink-btn"><ChevronsDown className="h-5 w-5" /></button>
            <button type="button" onClick={() => close(true)} className="icon-btn" aria-label="Close training" data-testid="training-close-btn"><X className="h-5 w-5" /></button>
          </div>
          <p className="min-h-0 flex-1 overflow-y-auto text-[15px] leading-snug text-[var(--navy)]" data-testid="training-step-text">{steps[at]}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(at - 1)} disabled={at === 0} className="btn-ghost h-11 flex-1 justify-center gap-1 disabled:opacity-40" data-testid="training-back-btn"><ChevronLeft className="h-4 w-4" /> Back</button>
            <button type="button" onClick={() => go(at + 1)} disabled={at >= steps.length - 1} className="btn-solid h-11 flex-1 justify-center gap-1 !bg-emerald-700 disabled:opacity-40" data-testid="training-next-btn">Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        </section>
      )}
    </>
  );
};
