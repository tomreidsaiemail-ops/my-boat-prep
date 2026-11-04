import { AlertTriangle, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Img } from "@/components/boat/PhotoSlots";
import { weatherUrl } from "@/components/boat/navigator/WeatherPhotos";
import { stamp } from "@/components/boat/departure/LogCopy";

const route = (boat) => [boat.route_start, boat.route_dest].map((s) => (s || "").trim()).filter(Boolean).join(" to ");

// The Ship's Log entry that records why the skipper decided to go.
export const departureDecision = (boat) => {
  const w = boat.weather || {};
  const photos = w.photos || [];
  const detail = [
    w.why?.trim() && `Why we're going: ${w.why.trim()}`,
    route(boat) && `Route: ${route(boat)}`,
    w.advice && `Magic Marine Navigator's advice${w.advice_at ? ` (${w.advice_at})` : ""}:\n${w.advice}`,
    ...photos.map((p, n) => `Weather and routing photo ${n + 1}${p.at ? ` (added ${new Date(p.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })})` : ""}: ${p.note?.trim() || "no note"}`),
  ].filter(Boolean).join("\n\n");
  return {
    id: Date.now(), checked: false, label: `Departure decision${route(boat) ? ` - ${route(boat)}` : ""} - ${stamp()}`,
    detail: detail || "No weather notes or photos were added before departure.",
    ...(photos.length ? { weather_photos: photos.map((p) => ({ photo_id: p.id, note: p.note || "" })) } : {}),
  };
};

export const DepartureLogDialog = ({ open, boat, boatId, onLog, onClose }) => {
  const w = boat.weather || {};
  const photos = w.photos || [];
  const url = weatherUrl(boatId);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto rounded-lg border-2 border-amber-500" data-testid="departure-log-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold"><AlertTriangle className="h-5 w-5 text-amber-600" /> About to log your departure</DialogTitle>
          <DialogDescription>Departure is ticked. Your weather and routing photos, your commentary and why you decided to go are about to be logged in the Ship's Log, in case conditions turn out differently.</DialogDescription>
        </DialogHeader>
        {photos.length ? (
          <ul className="grid grid-cols-3 gap-2" data-testid="departure-log-photos">
            {photos.map((p, n) => (
              <li key={p.id} className="flex flex-col gap-1">
                <Img url={url(p.id)} alt={`Weather and routing photo ${n + 1}`} className="h-20 w-full rounded border border-[var(--line)]" />
                <span className="line-clamp-2 text-xs text-[var(--muted)]">{p.note || "No note"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="departure-log-no-photos">No weather or routing photos yet. You can add them under the Magic Marine Navigator on the Route Hazards list.</p>
        )}
        <p className="text-sm" data-testid="departure-log-why"><b>Why we're going:</b> {w.why?.trim() || <span className="text-[var(--muted)]">not filled in</span>}</p>
        {w.advice && <p className="line-clamp-3 text-sm text-[var(--muted)]"><b>Navigator's advice:</b> {w.advice}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-solid h-11 flex-1 justify-center gap-2" onClick={onLog} data-testid="departure-log-confirm-btn"><ClipboardList className="h-4 w-4" /> Log it</button>
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="departure-log-later-btn">Not now</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
