import { CloudOff } from "lucide-react";

export const SyncBanner = ({ online, pending }) =>
  !online && pending > 0 ? (
    <div data-testid="outbox-banner" className="mbp-pop flex items-center gap-2 rounded-md bg-[var(--amber)] px-3 py-2.5 text-sm font-bold text-white">
      <CloudOff className="h-4 w-4 shrink-0" />
      Outbox: <span data-testid="outbox-count">{pending}</span> unsynced changes queued offline
    </div>
  ) : null;
