import { Lock, PackageSearch } from "lucide-react";

export const InventoryLocked = ({ onUpgrade }) => (
  <section className="flex flex-col items-start gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-5" data-testid="inventory-locked">
    <PackageSearch className="h-8 w-8 text-[var(--navy)]" />
    <h2 className="font-display text-lg font-extrabold text-[var(--navy)]">Know what's stowed where</h2>
    <p className="text-sm leading-relaxed text-[var(--muted)]">List every cupboard, locker and lazarette, what's inside and how many, and tick each item once it's on board. Tag checklist items by boat area too.</p>
    <button type="button" className="btn-solid h-12 px-5" onClick={onUpgrade} data-testid="inventory-upgrade-btn"><Lock className="h-4 w-4" /> Unlock with Pro</button>
  </section>
);
