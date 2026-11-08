import { FileCheck2, FileWarning } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// The skipper's view of whether a crew member read and accepted the Boat Terms and Conditions Agreement.
export const AgreementBadge = ({ agreement: a, testId }) => {
  const stops = a?.quick && a.full_at ? ` · Returning crew member opted for quick accept having done a full walk-through ${timeAgo(a.full_at)}`
    : a?.stops_total ? ` · ${a.stops.length}/${a.stops_total} walk-through stops ticked` : "";
  if (a?.accepted_at) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-800" data-testid={testId}>
        <FileCheck2 className="h-3.5 w-3.5 shrink-0" /> Read and accepted the agreement {day(a.accepted_at)}{stops}
      </p>
    );
  }
  return (
    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-800" data-testid={testId}>
      <FileWarning className="h-3.5 w-3.5 shrink-0" /> Agreement not accepted yet{stops}
    </p>
  );
};
