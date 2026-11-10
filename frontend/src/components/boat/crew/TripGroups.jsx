import { Map as MapIcon } from "lucide-react";
import { RsvpSummary } from "@/components/boat/Rsvp";
import { DEFAULT_TRIP, openList } from "@/lib/trips";

const tripOf = (i) => i.trip_id || DEFAULT_TRIP;

// Crew and invites under each Route Planning trip; trips no longer in the lists keep the name the invite was sent with.
export const tripGroups = (trips, crew, invites) => {
  const all = [...(trips.length ? trips : [{ id: DEFAULT_TRIP, name: "Route Planning" }])];
  const add = (id, name) => { if (!all.some((t) => t.id === id)) all.push({ id, name: name || "Removed trip" }); };
  invites.forEach((i) => add(tripOf(i), i.trip_name));
  crew.forEach((m) => (m.trips || [DEFAULT_TRIP]).forEach((id) => add(id)));
  return all.map((t) => ({ ...t, crew: crew.filter((m) => (m.trips || [DEFAULT_TRIP]).includes(t.id)), invites: invites.filter((i) => tripOf(i) === t.id) }))
    .filter((g) => g.crew.length + g.invites.length > 0);
};

export const TripLink = ({ trip, onOpen, testId }) => (
  <button type="button" className="inline-flex min-w-0 max-w-full items-center gap-1 text-left text-xs font-extrabold text-[var(--navy)] underline underline-offset-2" onClick={() => onOpen(trip.id)} data-testid={testId}>
    <MapIcon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{trip.name}{trip.event || trip.start ? ` · ${[trip.event, trip.start].filter(Boolean).join(", ")}` : ""}</span>
  </button>
);

const SHADES = ["border-sky-300 bg-sky-50", "border-amber-300 bg-amber-50"];

export const TripGroup = ({ group, n, onOpen, onClear, children }) => (
  <section className={`flex flex-col gap-2 rounded-md border-2 p-2 ${SHADES[n % 2]}`} data-testid={`crew-trip-group-${group.id}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1">
      <TripLink trip={group} onOpen={(id) => { onOpen?.(); openList(id); }} testId={`crew-trip-link-${group.id}`} />
      <span className="shrink-0 text-xs font-bold text-[var(--muted)]">{group.crew.length} joined · {group.invites.length} invited</span>
    </div>
    <RsvpSummary crew={group.crew.map((m) => ({ ...m, rsvp: m.trip_rsvp?.[group.id] || null }))} onClear={onClear} title={`${group.name} replies`} testId={`rsvp-summary-${group.id}`} />
    <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)] bg-white">{children}</ul>
  </section>
);
