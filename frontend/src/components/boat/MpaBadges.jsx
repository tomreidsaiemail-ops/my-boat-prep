import { Archive, Forward } from "lucide-react";
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

export const ProvBadge = ({ id }) => (
  <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 text-[10px] font-extrabold leading-none text-sky-800" title="From your Provisions list" data-testid={`mpa-prov-${id}`}><Forward className="h-3.5 w-3.5" />PROV</span>
);

export const OnBoardBadge = ({ id, areas }) => (
  <span className="inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full bg-emerald-100 px-2 text-[11px] font-bold leading-none text-emerald-800" title={`Already on board: ${areas.join(", ")}`} data-testid={`mpa-onboard-${id}`}>
    <Archive className="h-3.5 w-3.5 shrink-0" />
    <span className="truncate">{areas[0]}</span>
    {areas.length > 1 && <span className="shrink-0">+{areas.length - 1}</span>}
  </span>
);

// A synonym from the Food Synonyms lists is on board instead, e.g. "Table Salt · Galley Cupboard 1" for a recipe asking for sea salt.
export const SubBadge = ({ id, subs }) => {
  const all = subs.flatMap((x) => x.areas.map((a) => `${x.name} · ${a}`));
  return (
    <span className="inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full border border-dashed border-emerald-500 bg-emerald-50 px-2 text-[11px] font-bold leading-none text-emerald-800" title={`On board, may do instead: ${all.join(", ")}`} data-testid={`mpa-sub-${id}`}>
      <Archive className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{all[0]}</span>
      {all.length > 1 && <span className="shrink-0">+{all.length - 1}</span>}
    </span>
  );
};

export const MpaText = ({ item, text }) => {
  const m = item.mpa;
  if (!m || text !== mpaLabel(m)) return text;
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1" data-testid={`mpa-text-${item.id}`}>
      <span className="min-w-0 break-words">{m.base}</span>
      {m.prov && <ProvBadge id={item.id} />}
      {m.areas?.length > 0 && <OnBoardBadge id={item.id} areas={m.areas} />}
      {m.subs?.length > 0 && <SubBadge id={item.id} subs={m.subs} />}
      {(m.src || []).map((s) => <SourceTag key={s} tag={s} />)}
      {(m.meals || []).map((n) => <MealSquare key={n} n={n} />)}
    </span>
  );
};
