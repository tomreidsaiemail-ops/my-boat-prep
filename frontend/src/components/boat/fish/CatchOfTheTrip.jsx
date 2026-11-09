import { Fish, MapPin, Trophy } from "lucide-react";
import { API } from "@/lib/api";
import { sizeText } from "@/components/boat/fish/FishReport";
import { ShareCatchButton } from "@/components/boat/fish/ShareCatchButton";

const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA");
const dayText = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
// Biggest = heaviest; if no weights that day, the longest.
const score = (c) => [c.report.size?.weight_kg || 0, c.report.size?.length_cm || 0];
const bigger = (a, b) => { const [wa, la] = score(a), [wb, lb] = score(b); return wa !== wb ? wa > wb : la > lb; };

// Each day out: the biggest catch of the day as a shareable card.
export const catchesOfTheTrip = (list) => {
  const days = {};
  list.forEach((c) => {
    const k = dayKey(c.created_at);
    const d = days[k] || (days[k] = { key: k, count: 0, best: c });
    d.count += 1;
    if (bigger(c, d.best)) d.best = c;
  });
  return Object.values(days).sort((a, b) => b.key.localeCompare(a.key));
};

export const CatchOfTheTrip = ({ list, imperial, onOpen }) => {
  const days = catchesOfTheTrip(list).slice(0, 10);
  if (!days.length) return null;
  return (
    <section className="flex flex-col gap-2" data-testid="catch-of-trip">
      <h3 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide"><Trophy className="h-4 w-4 text-amber-500" /> Catch of the Trip</h3>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {days.map(({ key, count, best: c }) => {
          const size = sizeText(c.report.size || {}, imperial);
          const spot = c.report.place?.name || c.position;
          return (
            <article key={key} className="flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-lg border-2 border-[var(--navy)] bg-white" data-testid={`catch-of-trip-${key}`}>
              <button type="button" onClick={() => onOpen(c)} className="relative block text-left" data-testid={`catch-of-trip-open-${key}`}>
                {c.has_photo ? <img src={`${API}/me/catches/${c.catch_id}/photo`} alt={c.report.species.common_name} loading="lazy" className="h-36 w-full object-cover" />
                  : <span className="flex h-36 w-full items-center justify-center bg-sky-50"><Fish className="h-10 w-10" /></span>}
                <span className="absolute left-2 top-2 rounded bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold uppercase text-[var(--navy)]">{dayText(c.created_at)}</span>
              </button>
              <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                <p className="font-display text-base font-extrabold leading-tight" data-testid={`catch-of-trip-species-${key}`}>{c.report.species.common_name}</p>
                {size && <p className="text-xs font-bold">{size}</p>}
                {spot && <p className="flex items-center gap-1 truncate text-xs text-[var(--muted)]"><MapPin className="h-3.5 w-3.5 shrink-0" /> {spot}</p>}
                <p className="text-xs text-[var(--muted)]">Biggest of {count} {count === 1 ? "catch" : "catches"} that day</p>
                <div className="mt-auto pt-1 [&>button]:h-10 [&>button]:w-full [&>button]:text-sm">
                  <ShareCatchButton c={c} size={size} title={`Catch of the Trip · ${dayText(c.created_at)}`} label="Share" testId={`catch-of-trip-share-${key}`} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
