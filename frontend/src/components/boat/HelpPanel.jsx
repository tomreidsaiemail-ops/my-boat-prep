import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

// Collapsible help that starts open the first time only (remembered on this device).
export const HelpPanel = ({ storageKey, title, testId, children }) => {
  const [open, setOpen] = useState(() => {
    const first = localStorage.getItem(storageKey) !== "1";
    localStorage.setItem(storageKey, "1");
    return first;
  });
  return (
    <div className="rounded-md border border-[var(--navy)]/30 bg-sky-50" data-testid={testId}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold" data-testid={`${testId}-toggle`}>
        <HelpCircle className="h-4 w-4 shrink-0" /> {title}
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-2 px-3 pb-3 text-sm leading-relaxed" data-testid={`${testId}-body`}>{children}</div>}
    </div>
  );
};
