import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Footprints, Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { pinName } from "@/components/boat/PinnedPhoto";
import { walkSteps } from "@/components/boat/CrewWalkthrough";

const keyOf = (s) => `${s.pic.key}:${s.pin.id}`;

// The skipper picks which labelled cupboards are stops on the crew's Zone Map Walk Through (all, to start).
export const WalkStopsPicker = ({ boat, areas = [], online, onSaved }) => {
  const steps = walkSteps((boat.zone_maps || []).map((m) => ({ key: m.id, map: m, name: [m.zone, m.name].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "Zone map" })));
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(boat.walk_skip || []);
  const [busy, setBusy] = useState(false);
  if (!steps.length) return null;
  const saved = boat.walk_skip || [];
  const changed = skip.length !== saved.length || skip.some((s) => !saved.includes(s));
  const on = steps.filter((s) => !skip.includes(keyOf(s))).length;
  const flip = (k) => setSkip((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  const save = async () => {
    if (!online) { toast.error("Go online to save the walkthrough stops"); return; }
    setBusy(true);
    try {
      const { data } = await api.put(`/boats/${boat.boat_id}/walk-stops`, { skip });
      onSaved(data.walk_skip); setSkip(data.walk_skip);
      toast.success(`Walkthrough now has ${on} ${on === 1 ? "stop" : "stops"}`);
    } catch (e) { toast.error(apiError(e, "Couldn't save the walkthrough stops")); }
    finally { setBusy(false); }
  };
  const maps = [...new Map(steps.map((s) => [s.pic.key, s.pic])).values()];
  return (
    <div className="rounded-md border-[1.5px] border-[var(--line)]" data-testid="walk-stops-picker">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-bold" data-testid="walk-stops-toggle">
        <Footprints className="h-4 w-4 shrink-0" /> Walkthrough stops <span className="font-semibold text-[var(--muted)]" data-testid="walk-stops-count">({on} of {steps.length})</span>
        <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">Untick cupboards of less importance. Crew only see the ticked stops in the Boat Terms and Conditions walkthrough.</p>
          {maps.map((m) => (
            <div key={m.key} className="flex flex-col gap-1" data-testid={`walk-stops-map-${m.key}`}>
              <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]">{m.name}</p>
              {steps.filter((s) => s.pic.key === m.key).map((s) => (
                <label key={keyOf(s)} className="flex min-h-9 items-center gap-2.5 text-sm" data-testid={`walk-stop-${s.pin.id}`}>
                  <input type="checkbox" checked={!skip.includes(keyOf(s))} onChange={() => flip(keyOf(s))} className="h-5 w-5 accent-[var(--navy)]" data-testid={`walk-stop-${s.pin.id}-checkbox`} />
                  {pinName(s.pin, areas)}
                </label>
              ))}
            </div>
          ))}
          <button type="button" className="btn-solid h-11 justify-center gap-2" disabled={!changed || busy || !on} onClick={save} data-testid="walk-stops-save-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {on ? "Save walkthrough stops" : "Keep at least one stop"}
          </button>
        </div>
      )}
    </div>
  );
};
