import { useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LinkedText } from "@/components/boat/LinkedText";

// Help from an "Admin - Help Panel - ..." list: opens on tap, or on hover with a mouse. Indented items show as bullets.
export const HelpPanelIcon = ({ title, items, testId }) => {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const hover = (o) => (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(o), o ? 120 : 250);
  };
  if (!items?.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Help: ${title}`} onPointerEnter={hover(true)} onPointerLeave={hover(false)} data-testid={testId}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-[var(--navy)] hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] [transition:background-color_.15s]">
          <HelpCircle className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={10} onPointerEnter={hover(true)} onPointerLeave={hover(false)}
        className="max-h-[60vh] w-[min(calc(100vw-2rem),22rem)] overflow-y-auto border-2 border-[var(--navy)] p-4" data-testid={`${testId}-panel`}>
        <p className="mb-2 font-display text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">{title}</p>
        <div className="space-y-1.5 text-sm leading-relaxed text-slate-800">
          {items.map((i, k) => (
            <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""} data-testid={`${testId}-line-${k}`}>
              <LinkedText text={i.label} testId={`${testId}-link-${k}`} />
            </p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
