import { useState } from "react";
import { ArrowRight, ChevronDown, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useHold } from "@/lib/tripGuide";

// Highlighted yellow guide text.
export const GuideText = ({ children, testId }) => <p className="rounded-md bg-yellow-200 px-2.5 py-2 text-sm font-bold text-[var(--navy)]" data-testid={testId}>{children}</p>;
export const P = ({ children, testId }) => <p className="text-sm" data-testid={testId}>{children}</p>;
export const Bullets = ({ items, testId }) => (
  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm" data-testid={testId}>
    {items.map((t, n) => <li key={n} data-testid={testId && `${testId}-${n}`}>{t}</li>)}
  </ul>
);

// The yellow Continue, like the Welcome screen's; hold keeps it highlighted.
export const GoOn = ({ onClick, label = "Continue", hold = false, testId }) => {
  useHold(testId, hold);
  return (
    <button type="button" onClick={onClick} className="btn-solid mt-1 h-11 self-start gap-2 !border-2 !border-yellow-500 !bg-yellow-300 px-5 !text-[var(--navy)] hover:!bg-yellow-400" data-testid={testId}>
      {label} <ArrowRight className="h-4 w-4" />
    </button>
  );
};

const Skip = ({ onSkip, testId }) => (
  <button type="button" className="self-end text-xs font-bold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--navy)]" data-testid={testId}
    onClick={() => { onSkip(); toast.info("Trip Planning guide skipped. Start it again from Help > Model Vessel."); }}>Skip guide</button>
);

// A guide section: open while it's the current step, then folded into a yellow title that opens again.
export const GuideSection = ({ title, active, testId, onSkip, children }) => {
  const [open, setOpen] = useState(false);
  const shown = active || open;
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <button type="button" onClick={() => !active && setOpen((o) => !o)} aria-expanded={shown}
        className="flex min-h-11 w-full items-center gap-2 rounded-md border-[1.5px] border-yellow-500 bg-yellow-100 px-3 text-left text-sm font-extrabold text-[var(--navy)] hover:bg-yellow-200 [transition:background-color_.15s]" data-testid={`${testId}-toggle`}>
        <GraduationCap className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">{title}</span>
        {!active && <ChevronDown className={`h-5 w-5 shrink-0 [transition:transform_.2s] ${open ? "rotate-180" : ""}`} />}
      </button>
      {shown && (
        <div className="flex flex-col gap-2 border-l-4 border-yellow-400 pl-3" data-testid={`${testId}-body`}>
          {children}
          {active && onSkip && <Skip onSkip={onSkip} testId={`${testId}-skip-btn`} />}
        </div>
      )}
    </section>
  );
};
