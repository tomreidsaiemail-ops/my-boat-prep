import { Flag } from "lucide-react";
import { UnderwayBubble } from "@/components/boat/departure/UnderwayBubble";

// Arriving at Destination and Returning to Dock: the one-tap ARRIVED that ends the trip.
export const ArrivedCard = ({ underway, onArrive, big = false, label = "Arrived, all checks done", testId = "arrived" }) => (
  <section className={`flex flex-col gap-2.5 rounded-lg border-2 ${big ? "border-emerald-700 shadow-md" : "border-[var(--navy)]"} bg-white p-3.5`} data-testid={`${testId}-card`}>
    {underway?.trip_id ? (
      <>
        <UnderwayBubble underway={underway} big={big} testId={`${testId}-underway`} />
        {underway.line && <p className="text-sm font-semibold" data-testid={`${testId}-trip-line`}>{underway.line}</p>}
      </>
    ) : <p className="text-sm text-[var(--muted)]" data-testid={`${testId}-not-underway`}>No departure is marked underway.</p>}
    <button type="button" className="btn-solid h-14 justify-center gap-2 text-base font-extrabold uppercase tracking-wide" onClick={onArrive} data-testid={`${testId}-all-done-btn`}>
      <Flag className="h-5 w-5" /> {label}
    </button>
  </section>
);
