import { MapPin } from "lucide-react";
import { NetworkToggle } from "@/components/boat/NetworkToggle";
import { AccountMenu } from "@/components/boat/AccountMenu";

export const BrandMark = () => (
  <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0" role="img" aria-label="My Boat Prep" data-testid="brand-mark">
    <circle cx="24" cy="24" r="22.5" fill="#fff" stroke="var(--navy)" strokeWidth="2.5" />
    <path d="M23 8v21" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M24.2 9.5 34 28h-9.8z" fill="var(--navy)" />
    <path d="M21.8 13 14 28h7.8z" fill="var(--blue)" />
    <path d="M10 30.5h28l-3.6 5.2a2 2 0 0 1-1.6.8H15.2a2 2 0 0 1-1.6-.8z" fill="var(--navy)" />
    <text x="24" y="43.5" textAnchor="middle" fontSize="7" fontWeight="800" fontFamily="Public Sans, sans-serif" fill="var(--navy)">MBP</text>
    <circle cx="37.5" cy="11" r="5" fill="var(--green)" stroke="#fff" strokeWidth="1.4" />
    <path d="m35.2 11.1 1.6 1.6 3-3.2" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Header = ({ gps, online, pending, onGoOffline, onGoOnline, tripDate, onDateChange }) => (
  <header className="flex flex-col gap-3 border-b-2 border-[var(--navy)] pb-4" data-testid="app-header">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <BrandMark />
        <h1 className="whitespace-nowrap font-display text-xl font-extrabold tracking-tight sm:text-3xl" data-testid="app-title">My Boat Prep</h1>
      </div>
      <NetworkToggle online={online} pending={pending} onGoOffline={onGoOffline} onGoOnline={onGoOnline} />
    </div>
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-2" htmlFor="trip-date">
        <span className="field-label">Date</span>
        <input id="trip-date" type="date" value={tripDate} onChange={(e) => e.target.value && onDateChange(e.target.value)}
          className="h-11 rounded-md bg-[var(--navy)] px-2.5 font-mono text-sm font-bold text-white [color-scheme:dark] focus:outline-none focus:ring-4 focus:ring-[var(--blue)]/30" data-testid="date-input" />
      </label>
      <div className={`ml-auto flex items-start gap-1 text-right font-mono text-[11px] font-semibold leading-tight ${gps.status === "ok" ? "text-[var(--navy)]" : "text-[var(--muted)]"}`} data-testid="gps-position">
        <MapPin className="mt-px h-3 w-3 shrink-0" />
        <span>{gps.text}</span>
      </div>
      <AccountMenu />
    </div>
  </header>
);
