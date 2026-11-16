import { useState } from "react";
import { Eye, GraduationCap } from "lucide-react";
import { WIZARD_PREFIX, parseWizard, wizardTitle, wizardsFrom } from "@/lib/wizard";
import useAdminLists from "@/hooks/useAdminLists";
import { WizardWindow } from "@/components/boat/training/WizardWindow";

// Admin-only: run an "Admin - Model Vessel - *" wizard from the text being edited, before saving.
export const WizardPreview = ({ name, lines }) => {
  const [at, setAt] = useState(null);
  const [mini, setMini] = useState(false);
  // A "$$$" link opens that walkthrough's saved steps in the preview.
  const [other, setOther] = useState(null);
  const wizards = wizardsFrom(useAdminLists(WIZARD_PREFIX, true));
  const { steps, finish } = parseWizard(other ? other.lines : lines);
  const own = parseWizard(lines);
  const stop = () => { setAt(null); setMini(false); setOther(null); };
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-2 border-emerald-600 bg-emerald-50 p-3" data-testid="wizard-preview">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-900"><GraduationCap className="h-4 w-4" /> Model Vessel wizard: {own.steps.length} {own.steps.length === 1 ? "step" : "steps"}, {own.finish.filter((f) => f.kind === "tick").length} ticked on the Finish panel</p>
      <p className="text-xs text-emerald-900/80">On the Finish panel: -- is bold, --- gets a tick, $$ gets an idea bulb, $$$ links to another walkthrough by its name (e.g. $$$ Crew Registration and Invites...), and %% lines are closing paragraphs at the bottom. Every other line is a step.</p>
      <button type="button" className="btn-ghost h-10 justify-center gap-2 border-emerald-600 bg-white text-emerald-800" disabled={!own.steps.length} onClick={() => { setOther(null); setAt(0); }} data-testid="wizard-preview-btn">
        <Eye className="h-4 w-4" /> Preview wizard
      </button>
      {at !== null && (
        <WizardWindow t="wizard-preview" title={`Preview · ${other ? other.title : wizardTitle(name) || "Wizard"}`} steps={steps} finish={finish} at={Math.min(at, steps.length)} mini={mini}
          onGo={(n) => setAt(Math.max(0, n))} onShrink={setMini} onClose={stop} onFinish={stop}
          wizards={wizards} onOpen={(w) => { setOther(w); setAt(0); setMini(false); }} />
      )}
    </div>
  );
};
