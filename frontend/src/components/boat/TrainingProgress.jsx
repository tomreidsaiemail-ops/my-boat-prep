import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import useAdminLists from "@/hooks/useAdminLists";
import { useTrainingProgress } from "@/hooks/useWizardsDone";
import { WIZARD_PREFIX, wizardsFrom } from "@/lib/wizard";

const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "");

// User Settings > Training Progress: every Model Vessel tutorial with a tick once finished, and the extra magic earned.
export const TrainingProgress = ({ uid, online }) => {
  const wizards = wizardsFrom(useAdminLists(WIZARD_PREFIX, online));
  const p = useTrainingProgress(uid, online);
  const done = wizards.filter((w) => p.finished.includes(w.key)).length;
  return (
    <section className="flex flex-col gap-3" data-testid="training-progress">
      <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">Training Progress</h3>
      <div className="flex items-center gap-3 rounded-md border-2 border-amber-300 bg-amber-50 p-3" data-testid="training-magic-total">
        <Sparkles className="h-6 w-6 shrink-0 text-amber-600" />
        <span className="text-sm"><b className="text-lg">{p.total} extra magic</b> credited to your account
          <span className="block text-xs text-[var(--muted)]">Finish a Model Vessel tutorial while on Pro to earn 10 extra magic.</span></span>
      </div>
      <p className="text-xs font-bold text-[var(--muted)]" data-testid="training-count">{done} of {wizards.length} tutorials finished</p>
      <ul className="flex flex-col gap-1.5">
        {wizards.map((w) => {
          const fin = p.finished.includes(w.key);
          return (
            <li key={w.key} className={`flex items-center gap-2 rounded-md border-[1.5px] p-2.5 text-sm ${fin ? "border-emerald-300 bg-emerald-50" : "border-[var(--line)]"}`} data-testid={`training-row-${w.key.replace(/[^a-z0-9]+/g, "-")}`}>
              {fin ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--green)]" aria-label="Finished" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-label="Not finished yet" />}
              <span className="min-w-0 flex-1"><b>{w.title}</b>{fin && p.finishedAt[w.key] && <span className="block text-xs text-[var(--muted)]">Finished {when(p.finishedAt[w.key])}</span>}</span>
              {p.credited[w.key] > 0 && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 ring-1 ring-amber-300">+{p.credited[w.key]} magic</span>}
            </li>
          );
        })}
        {!wizards.length && <li className="text-sm text-[var(--muted)]">{online ? "Loading tutorials..." : "Tutorials show when you have a signal."}</li>}
      </ul>
    </section>
  );
};
