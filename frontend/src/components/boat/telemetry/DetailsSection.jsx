import { useState } from "react";
import { ChevronDown } from "lucide-react";

// A titled block in Boat details that opens and closes; shows a one-line summary while closed.
export const DetailsSection = ({ title, summary, defaultOpen = false, testId, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="col-span-2 rounded-lg border-[1.5px] border-[var(--line)]" data-testid={testId}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left" data-testid={`${testId}-toggle`}>
        <span className="min-w-0">
          <span className="field-label block">{title}</span>
          {!open && summary && <span className="block truncate text-sm font-semibold" data-testid={`${testId}-summary`}>{summary}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="grid grid-cols-2 gap-2.5 border-t-[1.5px] border-[var(--line)] p-3" data-testid={`${testId}-body`}>{children}</div>}
    </div>
  );
};
