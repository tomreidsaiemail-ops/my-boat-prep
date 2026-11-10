import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const keyFor = (id) => `mbp_magic_open_${id}`;

// A Magic Marine panel that can be folded away; the open/closed choice is remembered per list.
export const MagicPanel = ({ id, title, icon, children, testId }) => {
  const [open, setOpen] = useState(() => localStorage.getItem(keyFor(id)) !== "0");
  const toggle = () => setOpen((o) => { localStorage.setItem(keyFor(id), o ? "0" : "1"); return !o; });
  return (
    <section className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid={testId}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-[32px] items-center gap-2 text-left" data-testid={`${testId}-toggle`}>
        {icon}
        <span className="flex-1 text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">{title}</span>
        <span className="flex items-center gap-1 text-xs font-bold text-[var(--muted)]">
          {open ? "Hide" : "Show"} {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && children}
    </section>
  );
};
