import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { when } from "@/lib/routeNotes";

// Asked when a trip's estimated finish has passed (or from "Archive this trip"); Not now waits until tomorrow.
export const TripFinishPrompt = ({ ask, onConfirm, onClose }) => (
  <ConfirmDelete item={ask} testId="trip-finish" danger={false} confirmLabel="Archive and reset" cancelLabel={ask?.manual ? "Cancel" : "Not now"}
    title={ask?.manual ? `Archive ${ask.name}?` : `${ask?.name || "Your trip"} has finished`}
    note={ask?.manual ? "Save this trip to Archived Trips and start a clean slate for the next voyage." : `The estimated finish was ${when(ask?.finish) || ask?.finish}. Archive this trip and reset for a new voyage?`}
    body={(
      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--navy)]" data-testid="trip-finish-details">
        <li>Saved: the checklist and ticks, route and weather notes, crew and their replies, stats and the GPS path.</li>
        <li>Cleared: all ticks, dates, route and weather, and the crew and invites on this trip.</li>
        <li>You can Undo straight away, or Restore it later from Archived Trips.</li>
      </ul>
    )}
    onConfirm={onConfirm} onClose={onClose} />
);
