import { Flag } from "lucide-react";
import { UnderwayBubble } from "@/components/boat/departure/UnderwayBubble";

// Arriving at Destination and Returning to Dock: the one-tap ARRIVED that ends the trip.
export const ArrivedCard = ({ underway, onArrive }) => (
  <section className="flex flex-col gap-2.5 rounded-lg border-2 border-[var(--navy)] bg-white p-3.5" data-testid="arrived-card">
    {underway?.trip_id ? (
      <>
        <UnderwayBubble underway={underway} testId="arrived-underway" />
        {underway.line && <p className="text-sm font-semibold" data-testid="arrived-trip-line">{underway.line}</p>}
      </>
    ) : <p className="text-sm text-[var(--muted)]" data-testid="arrived-not-underway">No departure is marked underway.</p>}
    <button type="button" className="btn-solid h-14 justify-center gap-2 text-base font-extrabold uppercase tracking-wide" onClick={onArrive} data-testid="arrived-all-done-btn">
      <Flag className="h-5 w-5" /> Arrived, all checks done
    </button>
  </section>
);
