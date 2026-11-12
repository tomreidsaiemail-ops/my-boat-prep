import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { when } from "@/lib/routeNotes";

// Asked when a trip's estimated finish has passed (or from "Archive this trip"); Not now waits until tomorrow.
const Mail = ({ on, label, onChange, testId }) => (
  <label className="flex items-center gap-2 text-sm font-semibold" data-testid={`${testId}-label`}>
    <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--navy)]" data-testid={testId} /> {label}
  </label>
);

export const TripFinishPrompt = ({ ask, onConfirm, onClose, onMail }) => (
  <ConfirmDelete item={ask} testId="trip-finish" danger={false} confirmLabel="Archive and reset" cancelLabel={ask?.manual ? "Cancel" : "Not now"}
    title={ask?.manual ? `Archive ${ask.name}?` : `${ask?.name || "Your trip"} has finished`}
    note={ask?.manual ? "Save this trip to Archived Trips and start a clean slate for the next voyage." : `The estimated finish was ${when(ask?.finish) || ask?.finish}. Archive this trip and reset for a new voyage?`}
    body={(
      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--navy)]" data-testid="trip-finish-details">
        <li>Saved: the checklist and ticks, route and weather notes, crew and their replies, stats and the GPS path.</li>
        <li>Cleared: all ticks, dates, route and weather, and the crew and invites on this trip.</li>
        <li>You can Undo straight away, or Restore it later from Archived Trips.</li>
        <li>A wrap-up email with the route map, miles and crew goes to you 3 minutes later (not if you Undo). Also send it to:</li>
        <li className="list-none space-y-1 pt-1">
          <Mail on={ask?.mail?.shore !== false} label="Shore contacts" onChange={(v) => onMail("shore", v)} testId="trip-finish-mail-shore" />
          <Mail on={ask?.mail?.crew !== false} label="The trip's crew" onChange={(v) => onMail("crew", v)} testId="trip-finish-mail-crew" />
        </li>
      </ul>
    )}
    onConfirm={onConfirm} onClose={onClose} />
);
