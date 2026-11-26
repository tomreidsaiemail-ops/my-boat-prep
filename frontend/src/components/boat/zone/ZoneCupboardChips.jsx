import { ChevronDown } from "lucide-react";

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// "Your <zone> cupboards": tap one to scan it. Picking one folds the list ("... - Pantry selected"). glowName: the cupboard lit for the walkthrough.
export const ZoneCupboardChips = ({ zone, cups, name, open, onToggle, onPick, glowName = "" }) => {
  const picked = cups.find((a) => name.trim() && same(a.name, name));
  return (
    <div className="flex flex-col gap-1.5" data-testid="batch-area-zone-cupboards">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-8 items-center gap-1.5 text-left text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]" data-testid="batch-area-zone-cupboards-toggle">
        <span className="flex-1">Your {zone.label} cupboards{!open && picked && <span className="normal-case text-[var(--navy)]" data-testid="batch-area-zone-cupboards-selected"> - {picked.name} selected</span>}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {cups.map((a) => {
            const on = same(name, a.name);
            const lit = !on && glowName && same(a.name, glowName);
            return (
              <button key={a.id} type="button" onClick={() => onPick(a)} aria-pressed={on} data-testid={`batch-area-zone-cupboard-${a.id}`}
                className={`rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold [transition:background-color_.15s,color_.15s] ${lit ? "mbp-glow" : ""} ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white text-[var(--navy)] hover:border-[var(--navy)]"}`}>
                {a.name}{(a.items || []).length ? "" : " (empty)"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
