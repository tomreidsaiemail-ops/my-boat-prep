import { MapPin, Wifi, WifiOff } from "lucide-react";

export const BrandMark = () => (
  <div className="mbp-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M2 22h20M12 2v20M12 2C7 7 7 14 12 22M12 2c5 5 5 12 0 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>MBP</span>
  </div>
);

export const Header = ({ gps, online }) => (
  <header className="flex items-center justify-between gap-3 border-b-2 border-[var(--navy)] pb-4" data-testid="app-header">
    <div className="flex items-center gap-3">
      <BrandMark />
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl" data-testid="app-title">My Boat Prep</h1>
    </div>
    <div className="flex flex-col items-end gap-1.5 text-right">
      <div
        data-testid="network-status"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ${online ? "bg-[var(--green)]" : "bg-[var(--red)]"}`}
      >
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {online ? "Online" : "Offline"}
      </div>
      <div className={`flex items-start gap-1 font-mono text-[11px] font-semibold leading-tight ${gps.status === "ok" ? "text-[var(--navy)]" : "text-[var(--muted)]"}`} data-testid="gps-position">
        <MapPin className="mt-px h-3 w-3 shrink-0" />
        <span>{gps.text}</span>
      </div>
    </div>
  </header>
);
