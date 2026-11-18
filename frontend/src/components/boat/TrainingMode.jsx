import { useEffect, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import useAdminLists, { refreshAdminLists } from "@/hooks/useAdminLists";
import { EditStepDialog } from "@/components/boat/training/EditStepDialog";
import { EditFinishDialog } from "@/components/boat/training/EditFinishDialog";
import { BASIC, WIZARD_PREFIX, parseWizard, wizardsFrom } from "@/lib/wizard";
import { WizardWindow } from "@/components/boat/training/WizardWindow";
import { wizardEvent } from "@/hooks/useWizardsDone";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const RESTART = "mbp-model-walkthrough";
const openKey = (w) => `mbp_wizard_opened:${w}`;
const keys = (uid) => ({ step: `mbp_model_step:${uid}`, shut: `mbp_model_wizard_closed:${uid}`, mini: `mbp_model_wizard_mini:${uid}`, path: `mbp_model_path:${uid}`, answers: `mbp_model_answers:${uid}`, copy: `mbp_model_copy:${uid}`, which: `mbp_model_wizard:${uid}` });
const reset = (k, which = BASIC) => {
  localStorage.setItem(k.step, "0"); localStorage.setItem(k.path, "[]"); localStorage.setItem(k.answers, "{}"); localStorage.setItem(k.shut, "false"); localStorage.setItem(k.mini, "false"); localStorage.setItem(k.which, JSON.stringify(which));
};

// Help > Model Vessel > <walkthrough>: that wizard from step 1, open.
export const restartWalkthrough = (uid, which = BASIC) => { reset(keys(uid), which); window.dispatchEvent(new Event(RESTART)); };

// Model Vessel: a green page with a Training Mode strip and the chosen "Admin - Model Vessel - *" wizard.
// The wizard and step are remembered; X hides it until Show steps.
export const TrainingMode = ({ uid, online, copy = "", admin = false }) => {
  const [editing, setEditing] = useState(false);
  const wizards = wizardsFrom(useAdminLists(WIZARD_PREFIX, online));
  const k = keys(uid);
  // A freshly made copy of the Model Vessel starts the chosen walkthrough (Basic Introduction if none) again at step 1.
  useState(() => { if (copy && read(k.copy, "") !== copy) { reset(k, read(k.which, BASIC)); localStorage.setItem(k.copy, JSON.stringify(copy)); } });
  const [which, setWhich] = useState(() => read(k.which, BASIC));
  const [step, setStep] = useState(() => read(k.step, 0));
  // Panels visited (for Back) and the skipper's answers to "??" questions.
  const [path, setPath] = useState(() => read(k.path, []));
  const [answers, setAnswers] = useState(() => read(k.answers, {}));
  const [shut, setShut] = useState(() => read(k.shut, false));
  // Shrunk to one line so the screen behind (e.g. Delete Zone) can be reached; tap the line to bring it back.
  const [mini, setMini] = useState(() => read(k.mini, false));
  const opened = useRef("");
  useEffect(() => {
    const again = () => { opened.current = ""; sessionStorage.removeItem(openKey(read(k.which, BASIC))); setWhich(read(k.which, BASIC)); setStep(0); setPath([]); setAnswers({}); setShut(false); setMini(false); };
    window.addEventListener(RESTART, again);
    return () => window.removeEventListener(RESTART, again);
  }, [k.which]);
  const wizard = wizards.find((w) => w.key === which) || wizards.find((w) => w.key === BASIC) || wizards[0];
  const wiz = parseWizard(wizard?.lines);
  const { steps, raw, finishRaw } = wiz;
  const [editingFinish, setEditingFinish] = useState(false);
  const show = !shut && steps.length > 0;
  // Hidden while the admin edits a step or the Finish panel, so the edit window gets the whole screen.
  const win = show && !editing && !editingFinish;
  const at = Math.min(step, steps.length);
  const done = at === steps.length;
  // Counted once per app session, and again each time it's restarted from the Help menu or after Finish.
  useEffect(() => {
    if (!show || !wizard || opened.current === wizard.key) return;
    opened.current = wizard.key;
    if (sessionStorage.getItem(openKey(wizard.key))) return;
    sessionStorage.setItem(openKey(wizard.key), "1");
    wizardEvent(uid, wizard.key, "open");
  }, [show, wizard, uid]);
  useEffect(() => {
    document.body.classList.add("training-mode");
    return () => document.body.classList.remove("training-mode");
  }, []);
  useEffect(() => {
    document.body.classList.toggle("training-open", win && !mini && !done);
    document.body.classList.toggle("training-mini", win && mini && !done);
    document.body.classList.toggle("training-finish", win && done);
    return () => document.body.classList.remove("training-open", "training-mini", "training-finish");
  }, [win, mini, done]);
  const go = (n) => { setStep(n); localStorage.setItem(k.step, JSON.stringify(n)); };
  const move = (n, p, a) => { go(n); setPath(p); setAnswers(a); localStorage.setItem(k.path, JSON.stringify(p)); localStorage.setItem(k.answers, JSON.stringify(a)); };
  const close = (v) => { setShut(v); localStorage.setItem(k.shut, JSON.stringify(v)); };
  const shrink = (v) => { setMini(v); localStorage.setItem(k.mini, JSON.stringify(v)); };
  return (
    <>
      <div data-training-window className={`pointer-events-auto sticky top-0 z-[70] flex items-center justify-center gap-2 ${admin ? "bg-orange-700" : "bg-emerald-700"} px-3 py-1.5 text-center text-xs font-extrabold uppercase tracking-wide text-white print:hidden`} role="status" data-testid="training-mode-strip">
        <GraduationCap className="h-4 w-4 shrink-0" /> &ldquo;Model Vessel&rdquo; Training Mode
        {shut && steps.length > 0 && <button type="button" onClick={() => close(false)} className="ml-2 rounded-full bg-white px-2.5 py-0.5 text-[11px] text-emerald-800" data-testid="training-show-btn">Show steps</button>}
      </div>
      {win && <WizardWindow title={wizard.key === BASIC ? "Training" : wizard.title} wiz={wiz} at={at} path={path} answers={answers} mini={mini}
        onMove={move} onShrink={shrink} onClose={() => close(true)} onFinish={() => { wizardEvent(uid, wizard.key, "finish"); move(0, [], {}); close(true); opened.current = ""; sessionStorage.removeItem(openKey(wizard.key)); }}
        wizards={wizards} onOpen={(w) => { wizardEvent(uid, wizard.key, "finish"); restartWalkthrough(uid, w.key); }} onEdit={admin && online ? () => setEditing(true) : undefined}
        onEditFinish={admin && online ? () => setEditingFinish(true) : undefined} />}
      {admin && show && done && <EditFinishDialog open={editingFinish} wizard={wizard} raw={finishRaw} onClose={() => setEditingFinish(false)}
        onSaved={() => { setEditingFinish(false); refreshAdminLists(); }} />}
      {admin && show && !done && <EditStepDialog open={editing} wizard={wizard} step={wiz.editAt[at]} raw={raw[at] || ""} onClose={() => setEditing(false)}
        only={steps.length < 2} onSaved={(before) => { setEditing(false); move(at + before, path.map((p) => (p >= at ? p + before : p)), answers); refreshAdminLists(); }}
        onDeleted={() => { setEditing(false); move(at, path.filter((p) => p !== at).map((p) => (p > at ? p - 1 : p)), answers); refreshAdminLists(); }} />}
    </>
  );
};
