import { useState } from "react";
import { Eye, GraduationCap } from "lucide-react";
import { parseWizard, wizardTitle } from "@/lib/wizard";
import { WizardWindow } from "@/components/boat/training/WizardWindow";

// Admin-only: run an "Admin - Model Vessel - *" wizard from the text being edited, before saving.
export const WizardPreview = ({ name, lines }) => {
  const [at, setAt] = useState(null);
  const [mini, setMini] = useState(false);
  const { steps, finish } = parseWizard(lines);
  const stop = () => { setAt(null); setMini(false); };
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-2 border-emerald-600 bg-emerald-50 p-3" data-testid="wizard-preview">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-900"><GraduationCap className="h-4 w-4" /> Model Vessel wizard: {steps.length} {steps.length === 1 ? "step" : "steps"}, {finish.filter((f) => f.tick).length} ticked on the Finish panel</p>
      <p className="text-xs text-emerald-900/80">Lines starting -- are bold on the Finish panel, lines starting --- get a tick. Every other line is a step.</p>
      <button type="button" className="btn-ghost h-10 justify-center gap-2 border-emerald-600 bg-white text-emerald-800" disabled={!steps.length} onClick={() => setAt(0)} data-testid="wizard-preview-btn">
        <Eye className="h-4 w-4" /> Preview wizard
      </button>
      {at !== null && (
        <WizardWindow t="wizard-preview" title={`Preview · ${wizardTitle(name) || "Wizard"}`} steps={steps} finish={finish} at={Math.min(at, steps.length)} mini={mini}
          onGo={(n) => setAt(Math.max(0, n))} onShrink={setMini} onClose={stop} onFinish={stop} />
      )}
    </div>
  );
};
