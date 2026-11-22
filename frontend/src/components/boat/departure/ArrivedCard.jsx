import { Flag } from "lucide-react";
import { UnderwayBubble } from "@/components/boat/departure/UnderwayBubble";
import { arriveType } from "@/components/boat/navigator/ArriveType";

const dayWord = (d) => {
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const n = Math.round((day(d) - day(new Date())) / 86400000);
  return n === 0 ? "today" : n === 1 ? "tomorrow" : `on ${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`;
};
// The next planned leg not yet sailed, e.g. "Departing Tawa Bay tomorrow at 9:00AM" or "Returning to Dock, tomorrow at 9:00AM".
export const nextDepartureLine = (leg) => {
  const d = new Date(leg?.depart_at || "");
  if (!leg?.route_start || Number.isNaN(d.getTime())) return "";
  const when = `${dayWord(d)}${(leg.depart_at || "").length >= 16 ? ` at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(/\s/g, "")}` : ""}`;
  return arriveType(leg.arrive_type)?.key === "dock" ? `Returning to Dock, ${when}` : `Departing ${leg.route_start} ${when}`;
};

// Arriving at Destination and Returning to Dock: the one-tap ARRIVED that ends the trip.
export const ArrivedCard = ({ underway, onArrive, big = false, label = "Arrived, all checks done", testId = "arrived", next = "" }) => (
  <section className={`flex flex-col gap-2.5 rounded-lg border-2 ${big ? "border-emerald-700 shadow-md" : "border-[var(--navy)]"} bg-white p-3.5`} data-testid={`${testId}-card`}>
    {underway?.trip_id ? (
      <>
        <UnderwayBubble underway={underway} big={big} testId={`${testId}-underway`} />
        {underway.line && <p className="text-sm font-semibold" data-testid={`${testId}-trip-line`}>{underway.line}</p>}
      </>
    ) : next ? <p className="text-sm font-bold text-[var(--navy)]" data-testid={`${testId}-next-departure`}>{next}</p>
      : <p className="text-sm text-[var(--muted)]" data-testid={`${testId}-not-underway`}>No departure is marked underway.</p>}
    <button type="button" className="btn-solid h-14 justify-center gap-2 text-base font-extrabold uppercase tracking-wide" onClick={onArrive} data-testid={`${testId}-all-done-btn`}>
      <Flag className="h-5 w-5" /> {label}
    </button>
  </section>
);
