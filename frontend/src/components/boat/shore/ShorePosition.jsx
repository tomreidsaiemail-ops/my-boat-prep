import { toast } from "sonner";
import { Compass, Copy, MapPin } from "lucide-react";
import { formatPosition } from "@/hooks/useGps";
import { motion, motionText } from "@/lib/motion";

const stamp = (at) => new Date(at).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The boat's latest position for shore contacts: tap to copy it, ready to read to the Coastguard.
export const ShorePosition = ({ vessel, points }) => {
  const last = points[points.length - 1];
  const pos = formatPosition(last.lat, last.lon);
  const mv = motionText(motion(points));
  const copy = () => {
    const text = `${vessel} at ${stamp(last.at)}: ${pos.replace(" / ", ", ")}${mv ? `, ${mv.replace(" · ", ", ")}` : ""}`;
    navigator.clipboard?.writeText(text).then(() => toast.success("Position copied, ready to pass to the Coastguard"), () => toast.error("Couldn't copy, please write the position down"));
  };
  return (
    <div className="flex flex-col gap-1" data-testid="shore-watch-position-block">
      <button type="button" onClick={copy} className="flex items-start gap-1 self-start rounded-md px-1 py-0.5 -mx-1 text-left font-mono text-xs font-semibold leading-tight text-[var(--navy)] [transition:background-color_.15s] hover:bg-sky-50 active:bg-sky-100"
        title="Tap to copy the position" aria-label={`Copy position: ${pos}`} data-testid="shore-watch-position">
        <MapPin className="mt-px h-3.5 w-3.5 shrink-0" />
        <span className="flex flex-col">{pos.split(" / ").map((line) => <span key={line} className="whitespace-nowrap">{line}</span>)}</span>
        <Copy className="ml-1 mt-px h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
      </button>
      {mv && (
        <p className="flex items-center gap-1 font-mono text-xs font-semibold text-[var(--navy)]" data-testid="shore-watch-motion">
          <Compass className="h-3.5 w-3.5 shrink-0" /> {mv}
        </p>
      )}
    </div>
  );
};
