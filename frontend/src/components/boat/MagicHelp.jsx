import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { LinkedText } from "@/components/boat/LinkedText";

// Help from an "Admin - Help Panel - ..." list: shown until the user collapses it, then stays hidden on this device until reopened.
export const MagicHelp = ({ storageKey, title, items, fallback, testId }) => {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== "closed");
  const toggle = () => { localStorage.setItem(storageKey, open ? "closed" : "open"); setOpen(!open); };
  const lines = items?.length ? items : fallback.map((label) => ({ label }));
  return (
    <div className="rounded-md border border-[var(--navy)]/30 bg-sky-50 text-left" data-testid={testId}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[var(--navy)]" data-testid={`${testId}-toggle`}>
        <HelpCircle className="h-4 w-4 shrink-0" /> {title}
        <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 text-sm leading-relaxed text-slate-800" data-testid={`${testId}-body`}>
          {lines.map((i, k) => (
            <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""}><LinkedText text={i.label} testId={`${testId}-link-${k}`} /></p>
          ))}
        </div>
      )}
    </div>
  );
};
