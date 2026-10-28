import { mpaLabel } from "@/lib/mpa";

export const SourceTag = ({ tag }) => (
  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-[1.5px] border-[var(--navy)] px-1 text-[10px] font-extrabold leading-none text-[var(--navy)]" title={`From ${tag}`} data-testid={`mpa-src-${tag}`}>{tag}</span>
);

export const MealSquare = ({ n }) => (
  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] bg-[var(--navy)] px-1 text-[10px] font-extrabold leading-none text-white" title={`Meal ${n}`} data-testid={`mpa-meal-${n}`}>{n}</span>
);

export const FoodBadge = ({ className = "", testId }) => (
  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-emerald-700 text-[11px] font-extrabold leading-none text-emerald-800 ${className}`} title="Food area" aria-label="Food area" data-testid={testId}>F</span>
);

export const MpaText = ({ item, text }) => {
  const m = item.mpa;
  if (!m || text !== mpaLabel(m)) return text;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1" data-testid={`mpa-text-${item.id}`}>
      <span>{m.base}</span>
      {(m.src || []).map((s) => <SourceTag key={s} tag={s} />)}
      {(m.meals || []).map((n) => <MealSquare key={n} n={n} />)}
    </span>
  );
};
