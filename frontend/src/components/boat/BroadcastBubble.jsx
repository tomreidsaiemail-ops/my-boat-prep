import { useState } from "react";
import { CheckCircle2, MapPinned, Navigation } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { metres } from "@/hooks/useShoreTracking";

const NEAR_M = 100;

const NOTES = {
  b300: { label: "B300", title: "B300: shore contact tracking is on", text: "This phone is on land or within about 300 m of it, so its positions are kept private and not sent to your shore contact." },
  b300x: { label: "B300!", title: "B300!: broadcasting to your shore contact", text: "Positions on the water are being sent to your shore contact. Positions on land or within about 300 m of it stay private." },
  land: { label: "B/LAND!", title: "B/LAND!: broadcasting everywhere", text: "My settings > Ignore 300 metre is on, so every position from this phone is sent to your shore contact, including on land." },
};

const distText = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

// How far the boat is now from the last position the shore contact received.
const Proximity = ({ sent, gps }) => {
  if (!sent?.lat && sent?.lat !== 0) return <p className="text-xs text-[var(--muted)]" data-testid="broadcast-note-proximity">Your shore contact hasn't received a position on this trip yet.</p>;
  const here = gps.status === "ok" ? gps : gps.last;
  if (!here?.lat && here?.lat !== 0) return <p className="text-xs text-[var(--muted)]" data-testid="broadcast-note-proximity">Waiting for this phone's position to compare with the last broadcast.</p>;
  const m = metres(sent, here);
  return m <= NEAR_M
    ? <p className="flex items-start gap-1.5 font-semibold text-emerald-700" data-testid="broadcast-note-proximity" data-near="true"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Shore contact has received the approximate current location of the boat.</p>
    : <p className="flex items-start gap-1.5 font-semibold text-[var(--navy)]" data-testid="broadcast-note-proximity" data-near="false"><Navigation className="mt-0.5 h-4 w-4 shrink-0" />{distText(m)} from last broadcast.</p>;
};

// Shown while positions go to a shore contact. Dark blue means positions are being relayed right now.
export const BroadcastBubble = ({ mode, sent, gps }) => {
  const [open, setOpen] = useState(false);
  if (!mode) return null;
  const note = NOTES[mode];
  const dark = mode !== "b300";
  const openShore = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("mbp:open-crew", { detail: { section: "shore" } }));
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full px-2 font-mono text-[11px] font-extrabold [transition:transform_.1s] active:scale-95 ${dark ? "bg-[#0b2a5b] text-white" : "bg-sky-200 text-sky-900"}`}
          aria-label={`${note.title}. Tap for details`} data-testid="broadcast-bubble" data-mode={mode}>{note.label}</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-2 rounded-lg border-2 border-[var(--navy)] bg-white p-3 text-sm text-slate-800" data-testid="broadcast-note">
        <p className="font-display font-extrabold text-[var(--navy)]" data-testid="broadcast-note-title">{note.title}</p>
        <p className="text-xs leading-snug" data-testid="broadcast-note-text">{note.text}</p>
        <Proximity sent={sent} gps={gps} />
        <button type="button" onClick={openShore} className="btn-ghost mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs" data-testid="broadcast-note-open-shore-btn">
          <MapPinned className="h-4 w-4" /> Open Shore Contact panel
        </button>
      </PopoverContent>
    </Popover>
  );
};
