import { useEffect, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import useAdminLists, { refreshAdminLists } from "@/hooks/useAdminLists";
import { EditStepDialog } from "@/components/boat/training/EditStepDialog";
import { EditFinishDialog } from "@/components/boat/training/EditFinishDialog";
import { BASIC, CONFIG, WIZARD_PREFIX, parseWizard, startingWizard, wizardsFrom } from "@/lib/wizard";
import { WizardWindow } from "@/components/boat/training/WizardWindow";
import useWizardsDone, { wizardEvent } from "@/hooks/useWizardsDone";
import { api } from "@/lib/api";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const RESTART = "mbp-model-walkthrough";
const openKey = (w) => `mbp_wizard_opened:${w}`;
const keys = (uid) => ({ step: `mbp_model_step:${uid}`, shut: `mbp_model_wizard_closed:${uid}`, mini: `mbp_model_wizard_mini:${uid}`, path: `mbp_model_path:${uid}`, answers: `mbp_model_answers:${uid}`, copy: `mbp_model_copy:${uid}`, which: `mbp_model_wizard:${uid}`, fresh: `mbp_model_fresh:${uid}` });
// No walkthrough given (a fresh Model Vessel copy): the starting walkthrough until it's finished, then the last one used.
const reset = (k, which) => {
  localStorage.setItem(k.step, "0"); localStorage.setItem(k.path, "[]"); localStorage.setItem(k.answers, "{}"); localStorage.setItem(k.shut, "false"); localStorage.setItem(k.mini, "false");
  localStorage.setItem(k.fresh, JSON.stringify(which === undefined));
  if (which !== undefined) localStorage.setItem(k.which, JSON.stringify(which));
};

// Help > Model Vessel > <walkthrough>: that wizard from step 1, open.
// Remembered for the switch to the Model Vessel, so a first-ever copy there doesn't swap in the starting walkthrough.
const PENDING = "mbp_wizard_pending";
export const restartWalkthrough = (uid, which = BASIC) => { reset(keys(uid), which); sessionStorage.setItem(PENDING, "1"); window.dispatchEvent(new Event(RESTART)); };

// Model Vessel: a green page with a Training Mode strip and the chosen "Admin - Model Vessel - *" wizard.
// The wizard and step are remembered; X hides it until Show steps.
export const TrainingMode = ({ uid, online, copy = "", admin = false }) => {
  const [editing, setEditing] = useState(false);
  const wizards = wizardsFrom(useAdminLists(WIZARD_PREFIX, online));
  const k = keys(uid);
  const start = startingWizard(useAdminLists(CONFIG, online)) || BASIC;
  const finished = useWizardsDone(uid, online);
  // A freshly made copy of the Model Vessel starts again at step 1.
  useState(() => {
    const pending = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
    if (copy && read(k.copy, "") !== copy) { reset(k, pending ? read(k.which, BASIC) : undefined); localStorage.setItem(k.copy, JSON.stringify(copy)); }
  });
  const [which, setWhich] = useState(() => read(k.which, ""));
  const [fresh, setFresh] = useState(() => read(k.fresh, false));
  const [step, setStep] = useState(() => read(k.step, 0));
  // Panels visited (for Back) and the skipper's answers to "??" questions.
  const [path, setPath] = useState(() => read(k.path, []));
  const [answers, setAnswers] = useState(() => read(k.answers, {}));
  const [shut, setShut] = useState(() => read(k.shut, false));
  // Shrunk to one line so the screen behind (e.g. Delete Zone) can be reached; tap the line to bring it back.
  const [mini, setMini] = useState(() => read(k.mini, false));
  const opened = useRef("");
  useEffect(() => {
    const again = () => { sessionStorage.removeItem(PENDING); opened.current = ""; sessionStorage.removeItem(openKey(read(k.which, BASIC))); setWhich(read(k.which, BASIC)); setFresh(false); setStep(0); setPath([]); setAnswers({}); setShut(false); setMini(false); };
    window.addEventListener(RESTART, again);
    return () => window.removeEventListener(RESTART, again);
  }, [k.which]);
  // A fresh copy waits for the latest starting walkthrough and finished list, so the wrong one never flashes up.
  const [boot, setBoot] = useState(null);
  useEffect(() => {
    if (!fresh || !online) return undefined;
    let live = true;
    Promise.all([api.get("/admin-lists", { params: { prefix: CONFIG } }), api.get("/wizards/mine")])
      .then(([a, b]) => live && setBoot({ start: startingWizard(a.data.lists) || BASIC, finished: b.data.finished }))
      .catch(() => live && setBoot({}));
    return () => { live = false; };
  }, [fresh, online]);
  const first = boot?.start || start;
  const pick = fresh && !(boot?.finished || finished).includes(first) ? first : which || first;
  const wizard = wizards.find((w) => w.key === pick) || wizards.find((w) => w.key === first) || wizards.find((w) => w.key === BASIC) || wizards[0];
  const wiz = parseWizard(wizard?.lines);
  const { steps, raw, finishRaw } = wiz;
  const [editingFinish, setEditingFinish] = useState(false);
  const show = !shut && !(fresh && online && !boot) && steps.length > 0;
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
  // The first move locks in the walkthrough being shown, so it stays put after the starting one is finished.
  const go = (n) => {
    setStep(n); localStorage.setItem(k.step, JSON.stringify(n));
    if (wizard && (fresh || which !== wizard.key)) { setWhich(wizard.key); setFresh(false); localStorage.setItem(k.which, JSON.stringify(wizard.key)); localStorage.setItem(k.fresh, "false"); }
  };
  const move = (n, p, a) => { go(n); setPath(p); setAnswers(a); localStorage.setItem(k.path, JSON.stringify(p)); localStorage.setItem(k.answers, JSON.stringify(a)); };
  const close = (v) => { setShut(v); localStorage.setItem(k.shut, JSON.stringify(v)); };
  // Windows open below the training (and admin) strip, so their X close buttons are never hidden under it.
  const strip = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    const put = () => { const b = Math.max(0, Math.round(strip.current?.getBoundingClientRect().bottom || 0)); root.style.setProperty("--mbp-top", `${b}px`); };
    put();
    const ro = new ResizeObserver(put);
    if (strip.current) ro.observe(strip.current);
    window.addEventListener("scroll", put, { passive: true });
    window.addEventListener("resize", put);
    root.setAttribute("data-training-top", "");
    return () => { ro.disconnect(); window.removeEventListener("scroll", put); window.removeEventListener("resize", put); root.removeAttribute("data-training-top"); root.style.removeProperty("--mbp-top"); };
  }, []);
  const shrink = (v) => { setMini(v); localStorage.setItem(k.mini, JSON.stringify(v)); };
  return (
    <>
      <div ref={strip} data-training-window className={`pointer-events-auto sticky top-0 z-[70] flex items-center justify-center gap-2 ${admin ? "bg-orange-700" : "bg-emerald-700"} px-3 py-1.5 text-center text-xs font-extrabold uppercase tracking-wide text-white print:hidden`} role="status" data-testid="training-mode-strip">
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
