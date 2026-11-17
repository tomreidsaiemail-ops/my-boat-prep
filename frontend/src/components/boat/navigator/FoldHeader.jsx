import { ChevronDown } from "lucide-react";

// A section title that opens and closes the section below it.
export const FoldHeader = ({ open, onToggle, icon: Icon, children, testId }) => (
  <button type="button" onClick={onToggle} aria-expanded={open}
    className="flex min-h-11 w-full items-center gap-2 rounded-md border-[1.5px] border-[var(--line)] bg-white px-3 text-left text-sm font-extrabold uppercase tracking-wide text-[var(--navy)] hover:bg-slate-50 [transition:background-color_.15s]" data-testid={testId}>
    {Icon && <Icon className="h-4 w-4 shrink-0" />}
    <span className="min-w-0 flex-1">{children}</span>
    <ChevronDown className={`h-5 w-5 shrink-0 [transition:transform_.2s] ${open ? "rotate-180" : ""}`} />
  </button>
);
