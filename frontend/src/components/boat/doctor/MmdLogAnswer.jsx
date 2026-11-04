import { useState } from "react";
import { ChevronDown, ChevronRight, CloudSun, Stethoscope } from "lucide-react";

const KINDS = {
  mmd: { icon: Stethoscope, show: "Show the Doctor's answer", hide: "Hide the Doctor's answer", testId: "mmd-log" },
  depart: { icon: CloudSun, show: "Show the departure reasoning", hide: "Hide the departure reasoning", testId: "depart-log" },
};

// Long Ship's Log text (the Doctor's answer, or a departure decision) stays folded until tapped.
export const MmdLogAnswer = ({ id, answer, kind = "mmd" }) => {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;
  const k = KINDS[kind];
  return (
    <div className="basis-full pb-2 pl-12 pr-3" data-testid={`${k.testId}-${id}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`${k.testId}-toggle-${id}`}
        className="flex items-center gap-1 rounded-md text-xs font-bold text-[var(--navy)] [transition:opacity_.15s] hover:opacity-80">
        <Icon className="h-4 w-4" /><k.icon className="h-3.5 w-3.5" /> {open ? k.hide : k.show}
      </button>
      {open
        ? <p className={`mt-1.5 whitespace-pre-line rounded-md border-l-4 bg-[var(--panel)] px-3 py-2 text-sm ${kind === "mmd" ? "border-[var(--red)]" : "border-[var(--navy)]"}`} data-testid={`${k.testId}-answer-${id}`}>{answer}</p>
        : <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]" data-testid={`${k.testId}-preview-${id}`}>{answer}</p>}
    </div>
  );
};
