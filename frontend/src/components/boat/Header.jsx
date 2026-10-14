import { MapPin } from "lucide-react";
import { NetworkToggle } from "@/components/boat/NetworkToggle";

export const BrandMark = () => (
  <div className="mbp-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M2 22h20M12 2v20M12 2C7 7 7 14 12 22M12 2c5 5 5 12 0 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>MBP</span>
  </div>
);

export const Header = ({ gps, online, pending, onGoOffline, onGoOnline }) => (
  <header className="flex items-center justify-between gap-3 border-b-2 border-[var(--navy)] pb-4" data-testid="app-header">
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      <h1 className="whitespace-nowrap font-display text-xl font-extrabold tracking-tight sm:text-3xl" data-testid="app-title">My Boat Prep</h1>
    </div>
    <div className="flex flex-col items-end gap-1.5 text-right">
      <NetworkToggle online={online} pending={pending} onGoOffline={onGoOffline} onGoOnline={onGoOnline} />
      <div className={`flex items-start gap-1 font-mono text-[11px] font-semibold leading-tight ${gps.status === "ok" ? "text-[var(--navy)]" : "text-[var(--muted)]"}`} data-testid="gps-position">
        <MapPin className="mt-px h-3 w-3 shrink-0" />
        <span>{gps.text}</span>
      </div>
    </div>
  </header>
);
