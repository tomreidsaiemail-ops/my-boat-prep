const Flag = ({ on, letter, label, onClick, testId, colour }) => (
  <button type="button" onClick={onClick} aria-pressed={on} aria-label={`${on ? "Unflag" : "Flag"} as ${label} area`} title={`${label} area`} data-testid={testId}
    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] text-xs font-extrabold [transition:background-color_.15s] ${on ? `${colour} text-white` : "border-[var(--line)] text-[var(--muted)]"}`}>{letter}</button>
);

// Every cupboard with its F (food) and D (drinks) flags; flagged areas feed the Magic Bartender.
export const BarAreas = ({ areas, onFlag }) => {
  const sorted = [...areas].sort((a, b) => (b.drinks ? 2 : b.food ? 1 : 0) - (a.drinks ? 2 : a.food ? 1 : 0));
  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto" data-testid="bartender-areas">
      {sorted.map((a) => {
        const n = (a.items || []).filter((i) => !i.removed).length;
        return (
          <li key={a.id} className={`flex items-center gap-2 rounded-md border-[1.5px] px-2 py-1.5 ${a.food || a.drinks ? "border-[var(--navy)] bg-white" : "border-[var(--line)] bg-slate-50"}`} data-testid={`bartender-area-${a.id}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{a.name}</span>
              <span className="text-xs text-[var(--muted)]">{n} {n === 1 ? "item" : "items"}</span>
            </span>
            <Flag on={!!a.food} letter="F" label="Food" colour="border-emerald-700 bg-emerald-700" onClick={() => onFlag(a.id, "food")} testId={`bartender-area-food-${a.id}`} />
            <Flag on={!!a.drinks} letter="D" label="Drinks" colour="border-purple-700 bg-purple-700" onClick={() => onFlag(a.id, "drinks")} testId={`bartender-area-drinks-${a.id}`} />
          </li>
        );
      })}
    </ul>
  );
};
