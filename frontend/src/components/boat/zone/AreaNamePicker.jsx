import { Check } from "lucide-react";
import useAdminLists, { stripPrefix } from "@/hooks/useAdminLists";

const PREFIX = "Admin - Common ";
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Preferred boat area names for a zone, from "Admin - Common <Zone> Names"; names already on the boat show dimmed with a tick.
export const AreaNamePicker = ({ zone, name, used, onPick }) => {
  const lists = useAdminLists(PREFIX, navigator.onLine);
  const want = `${zone.label} names`.toLowerCase();
  const names = (lists.find((l) => stripPrefix(l.name, PREFIX).toLowerCase().replace(/\s+/g, " ") === want)?.items || []).map((i) => i.label.trim()).filter(Boolean);
  if (!names.length) return null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="area-name-picker">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Common {zone.label} names</span>
      <div className="flex flex-wrap gap-1.5">
        {names.map((n, i) => {
          const on = same(name, n), taken = used.some((u) => same(u, n));
          return (
            <button key={n} type="button" onClick={() => onPick(n)} aria-pressed={on} title={taken ? `${n} is already on your boat. Picking it rescans it.` : undefined} data-testid={`area-name-chip-${i}`}
              className={`flex items-center gap-1 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold [transition:background-color_.15s,color_.15s] ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white text-[var(--navy)] hover:border-[var(--navy)]"} ${taken && !on ? "opacity-50" : ""}`}>
              {taken && <Check className="h-3.5 w-3.5" data-testid={`area-name-chip-${i}-used`} />}{n}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-[var(--muted)]">Or type your own name below.</span>
    </div>
  );
};
