import { useState } from "react";
import { ChevronDown, ChevronRight, Stethoscope } from "lucide-react";

// Ship's Log entry from the Magic Marine Doctor: the long answer stays folded until tapped.
export const MmdLogAnswer = ({ id, answer }) => {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <div className="basis-full pb-2 pl-12 pr-3" data-testid={`mmd-log-${id}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`mmd-log-toggle-${id}`}
        className="flex items-center gap-1 rounded-md text-xs font-bold text-[var(--navy)] [transition:opacity_.15s] hover:opacity-80">
        <Icon className="h-4 w-4" /><Stethoscope className="h-3.5 w-3.5" /> {open ? "Hide the Doctor's answer" : "Show the Doctor's answer"}
      </button>
      {open
        ? <p className="mt-1.5 whitespace-pre-line rounded-md border-l-4 border-[var(--red)] bg-[var(--panel)] px-3 py-2 text-sm" data-testid={`mmd-log-answer-${id}`}>{answer}</p>
        : <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]" data-testid={`mmd-log-preview-${id}`}>{answer}</p>}
    </div>
  );
};
