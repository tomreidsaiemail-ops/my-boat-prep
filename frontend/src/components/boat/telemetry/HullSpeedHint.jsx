import { Gauge } from "lucide-react";
import { hullSpeed } from "@/lib/telemetry";

const FAST = /catamaran|trimaran|motor|launch|runabout|rib/i;

// Theoretical hull speed from the waterline length; nothing changes until the skipper taps Use.
export const HullSpeedHint = ({ boat, onUse, testId = "hull-speed" }) => {
  const hull = hullSpeed(boat);
  if (!hull) return null;
  const cruise = Math.round(hull * 8) / 10;
  const current = parseFloat(boat.cruise_kn) || 0;
  return (
    <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-md bg-[var(--panel)] px-3 py-2 text-sm" data-testid={testId}>
      <Gauge className="h-4 w-4 shrink-0 text-[var(--navy)]" />
      <span className="min-w-0 flex-1" data-testid={`${testId}-text`}>
        Hull speed <b>{hull.toFixed(1)} kn</b>. Comfortable cruising about <b>{cruise} kn</b> (80%).
        {FAST.test(boat.boat_type || "") && <span className="block text-xs text-[var(--muted)]">Multihulls and planing boats can go faster than this.</span>}
      </span>
      {current !== cruise && (
        <button type="button" className="btn-ghost h-9 min-h-0 px-3 text-xs" onClick={() => onUse(String(cruise))} data-testid={`${testId}-use-btn`}>
          Use {cruise} kn
        </button>
      )}
    </div>
  );
};
