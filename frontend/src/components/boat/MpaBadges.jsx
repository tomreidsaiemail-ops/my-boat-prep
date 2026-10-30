import { Archive, ChevronDown, Forward } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LinkedText } from "@/components/boat/LinkedText";
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

const stop = (e) => e.stopPropagation();
// Badge showing the first place; with more, tapping it opens the full list (inside the tick button, so taps never tick the row).
const PlacesBadge = ({ testId, title, heading, places, className }) => {
  const head = (
    <>
      <Archive className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{places[0]}</span>
    </>
  );
  const base = `inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full px-2 text-[11px] font-bold leading-none text-emerald-800 ${className}`;
  if (places.length < 2) return <span className={base} title={title} data-testid={testId}>{head}</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span role="button" tabIndex={0} aria-label={`${title}. Show all ${places.length}`} onClick={stop}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
          className={`${base} cursor-pointer ring-emerald-600 transition-shadow hover:ring-1 focus-visible:outline-none focus-visible:ring-2`} data-testid={testId}>
          {head}
          <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] text-white" data-testid={`${testId}-more`}>+{places.length - 1}<ChevronDown className="h-3 w-3" /></span>
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[85vw] p-3" onClick={stop} data-testid={`${testId}-list`}>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]">{heading}</p>
        <ul className="space-y-1.5">
          {places.map((p, i) => (
            <li key={p} className="flex items-start gap-2 text-sm font-semibold text-slate-800" data-testid={`${testId}-option-${i}`}>
              <Archive className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="break-words">{p}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export const OnBoardBadge = ({ id, areas }) => (
  <PlacesBadge testId={`mpa-onboard-${id}`} title={`Already on board: ${areas.join(", ")}`} heading="Already on board in" places={areas} className="bg-emerald-100" />
);

// A possible match on board, found via the admin food lists, splitting or noise words, e.g. "Table Salt · Galley Cupboard 1" for a recipe asking for sea salt.
export const SubBadge = ({ id, subs }) => {
  const all = subs.flatMap((x) => x.areas.map((a) => `${x.name} · ${a}`));
  return <PlacesBadge testId={`mpa-sub-${id}`} title={`On board, may do instead: ${all.join(", ")}`} heading="On board, may do instead" places={all} className="border border-dashed border-emerald-500 bg-emerald-50" />;
};

export const MpaText = ({ item, text }) => {
  const m = item.mpa;
  if (!m || text !== mpaLabel(m)) return <LinkedText text={text} testId={`checklist-item-${item.id}`} />;
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1" data-testid={`mpa-text-${item.id}`}>
      <span className="min-w-0 break-words"><LinkedText text={m.base} testId={`checklist-item-${item.id}`} /></span>
      {m.prov && <ProvBadge id={item.id} />}
      {m.areas?.length > 0 && <OnBoardBadge id={item.id} areas={m.areas} />}
      {m.subs?.length > 0 && <SubBadge id={item.id} subs={m.subs} />}
      {(m.src || []).map((s) => <SourceTag key={s} tag={s} />)}
      {(m.meals || []).map((n) => <MealSquare key={n} n={n} />)}
    </span>
  );
};
