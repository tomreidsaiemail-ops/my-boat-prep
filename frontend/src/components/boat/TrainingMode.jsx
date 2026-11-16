import { useEffect, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import useAdminLists from "@/hooks/useAdminLists";
import { BASIC, WIZARD_PREFIX, parseWizard, wizardsFrom } from "@/lib/wizard";
import { WizardWindow } from "@/components/boat/training/WizardWindow";
import { wizardEvent } from "@/hooks/useWizardsDone";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const RESTART = "mbp-model-walkthrough";
const keys = (uid) => ({ step: `mbp_model_step:${uid}`, shut: `mbp_model_wizard_closed:${uid}`, mini: `mbp_model_wizard_mini:${uid}`, copy: `mbp_model_copy:${uid}`, which: `mbp_model_wizard:${uid}` });
const reset = (k, which = BASIC) => {
  localStorage.setItem(k.step, "0"); localStorage.setItem(k.shut, "false"); localStorage.setItem(k.mini, "false"); localStorage.setItem(k.which, JSON.stringify(which));
};

// Help > Model Vessel > <walkthrough>: that wizard from step 1, open.
export const restartWalkthrough = (uid, which = BASIC) => { reset(keys(uid), which); window.dispatchEvent(new Event(RESTART)); };

// Model Vessel: a green page with a Training Mode strip and the chosen "Admin - Model Vessel - *" wizard.
// The wizard and step are remembered; X hides it until Show steps.
export const TrainingMode = ({ uid, online, copy = "" }) => {
  const wizards = wizardsFrom(useAdminLists(WIZARD_PREFIX, online));
  const k = keys(uid);
  // A freshly made copy of the Model Vessel starts the Basic Introduction again at step 1.
  useState(() => { if (copy && read(k.copy, "") !== copy) { reset(k); localStorage.setItem(k.copy, JSON.stringify(copy)); } });
  const [which, setWhich] = useState(() => read(k.which, BASIC));
  const [step, setStep] = useState(() => read(k.step, 0));
  const [shut, setShut] = useState(() => read(k.shut, false));
  // Shrunk to one line so the screen behind (e.g. Delete Zone) can be reached; tap the line to bring it back.
  const [mini, setMini] = useState(() => read(k.mini, false));
  const opened = useRef("");
  useEffect(() => {
    const again = () => { opened.current = ""; setWhich(read(k.which, BASIC)); setStep(0); setShut(false); setMini(false); };
    window.addEventListener(RESTART, again);
    return () => window.removeEventListener(RESTART, again);
  }, [k.which]);
  const wizard = wizards.find((w) => w.key === which) || wizards.find((w) => w.key === BASIC) || wizards[0];
  const { steps, finish } = parseWizard(wizard?.lines);
  const show = !shut && steps.length > 0;
  const at = Math.min(step, steps.length);
  const done = at === steps.length;
  // Counted once each time a walkthrough is shown (sign-in, Help menu or Show steps).
  useEffect(() => { if (show && wizard && opened.current !== wizard.key) { opened.current = wizard.key; wizardEvent(uid, wizard.key, "open"); } }, [show, wizard, uid]);
  useEffect(() => {
    document.body.classList.add("training-mode");
    return () => document.body.classList.remove("training-mode");
  }, []);
  useEffect(() => {
    document.body.classList.toggle("training-open", show && !mini && !done);
    document.body.classList.toggle("training-mini", show && mini && !done);
    document.body.classList.toggle("training-finish", show && done);
    return () => document.body.classList.remove("training-open", "training-mini", "training-finish");
  }, [show, mini, done]);
  const go = (n) => { setStep(n); localStorage.setItem(k.step, JSON.stringify(n)); };
  const close = (v) => { setShut(v); localStorage.setItem(k.shut, JSON.stringify(v)); };
  const shrink = (v) => { setMini(v); localStorage.setItem(k.mini, JSON.stringify(v)); };
  return (
    <>
      <div data-training-window className="pointer-events-auto sticky top-0 z-[70] flex items-center justify-center gap-2 bg-emerald-700 px-3 py-1.5 text-center text-xs font-extrabold uppercase tracking-wide text-white print:hidden" role="status" data-testid="training-mode-strip">
        <GraduationCap className="h-4 w-4 shrink-0" /> &ldquo;Model Vessel&rdquo; Training Mode
        {shut && steps.length > 0 && <button type="button" onClick={() => close(false)} className="ml-2 rounded-full bg-white px-2.5 py-0.5 text-[11px] text-emerald-800" data-testid="training-show-btn">Show steps</button>}
      </div>
      {show && <WizardWindow title={wizard.key === BASIC ? "Training" : wizard.title} steps={steps} finish={finish} at={at} mini={mini}
        onGo={go} onShrink={shrink} onClose={() => close(true)} onFinish={() => { wizardEvent(uid, wizard.key, "finish"); go(0); close(true); opened.current = ""; }} />}
    </>
  );
};
