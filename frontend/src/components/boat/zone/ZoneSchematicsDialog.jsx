import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, ImagePlus, Loader2, RefreshCw, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

const boatName = (b) => [b.make, b.model].map((s) => (s || "").trim()).filter(Boolean).join(" ");
export const zoneMapLabel = (b) => `Create ${(b.boat_type || "").trim() || "boat"} ZONE MAP OVERVIEWS for a ${boatName(b)}...`;
const boatBody = (b, fresh) => ({ boat_type: b.boat_type || "", make: b.make || "", model: b.model || "", year_built: b.year_built || "", fresh });

const Thumb = ({ r, picked, onPick }) => (
  <button type="button" onClick={() => onPick(r.id)} aria-pressed={picked}
    className={`group flex flex-col overflow-hidden rounded-md border-2 bg-white text-left [transition:border-color_.15s,transform_.15s] active:scale-[.98] ${picked ? "border-[var(--navy)] ring-2 ring-[var(--navy)]" : "border-[var(--line)]"}`}
    data-testid={`zone-search-result-${r.id}`}>
    <span className="relative flex aspect-[4/3] items-center justify-center bg-white">
      <img src={r.thumb} alt={r.title || "Schematic search result"} loading="lazy" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
      {picked && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-[var(--navy)] p-0.5 text-white" />}
    </span>
    <span className="truncate border-t border-[var(--line)] px-1.5 py-1 text-[11px] font-bold text-[var(--muted)]">{r.host}</span>
  </button>
);

// Web image search for the boat's schematic ("schematic overhead image line drawing YEAR MAKE MODEL"); the skipper taps the right one
// and it becomes a Zone Map Overview, kept private to the boat with its source link. One Magic use per search.
export const ZoneSchematicsDialog = ({ open, boat, boatId, online, onDone, onClose }) => {
  const [search, setSearch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const run = async (fresh = false) => {
    setError(""); setPicked(null); setSearch(null);
    if (!online) { setError("Searching the web needs a signal"); return; }
    setLoading(true);
    try { setSearch((await api.post(`/boats/${boatId}/zone-schematics/search`, boatBody(boat, fresh), { timeout: 30000 })).data); }
    catch (e) { setError(apiError(e, "The search didn't work, please try again")); }
    setLoading(false);
  };
  useEffect(() => { if (open) run(); else { setSearch(null); setPicked(null); setError(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const use = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/boats/${boatId}/zone-schematics/search/${search.search_id}/pick`, { result_id: picked }, { timeout: 45000 });
      toast.success("Zone Map Overview added. Drag your colours onto it.");
      onDone(data.zone_maps);
    } catch (e) { toast.error(apiError(e, "Couldn't add that picture, please pick another")); }
    setBusy(false);
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a picture"); return; }
    const form = new FormData();
    form.append("file", blob, "zone-overview.jpg");
    form.append("kind", "overview");
    setBusy(true);
    try { onDone((await api.post(`/boats/${boatId}/zone-maps`, form, { timeout: 60000 })).data.zone_maps); toast.success("Your diagram was added as a Zone Map Overview"); }
    catch (e2) { toast.error(apiError(e2, "Couldn't save your diagram")); }
    setBusy(false);
  };
  const hit = search?.results.find((r) => r.id === picked);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="zone-plans-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold"><Search className="h-5 w-5 shrink-0" /> {zoneMapLabel(boat).replace(/\.\.\.$/, "")}</DialogTitle>
          <DialogDescription className="text-left text-xs">Pictures found on the web. Tap the one that matches your boat. It&apos;s kept private to your boat, with a link to where it came from.</DialogDescription>
        </DialogHeader>
        {search && <p className="text-xs text-[var(--muted)]" data-testid="zone-search-query">Searched: &ldquo;{search.query}&rdquo;</p>}
        {error && <div role="alert" className="flex flex-col gap-2 rounded-md bg-red-50 p-3 text-sm font-bold text-[var(--red)]" data-testid="zone-plans-error">{error}
          <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => run(true)} data-testid="zone-plans-retry-btn">Try again</button></div>}
        {loading && (
          <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-[var(--line)] text-sm text-[var(--muted)]" data-testid="zone-plan-waiting">
            <Loader2 className="h-6 w-6 animate-spin" /> Searching the web for your boat&apos;s schematic...
          </div>
        )}
        {search && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="zone-search-grid">
            {search.results.map((r) => <Thumb key={r.id} r={r} picked={picked === r.id} onPick={setPicked} />)}
          </div>
        )}
        {hit?.source_url && (
          <a href={hit.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-[var(--navy)] underline" data-testid="zone-search-source-link">
            <ExternalLink className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">See it on {hit.host}</span>
          </a>
        )}
        {search && (
          <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!picked || busy} onClick={use} data-testid="zone-search-use-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {picked ? "Use this schematic" : "Tap the picture that matches your boat"}
          </button>
        )}
        <button type="button" className="btn-ghost h-12 justify-center gap-2" disabled={busy} onClick={() => input.current?.click()} data-testid="zone-search-upload-btn">
          <ImagePlus className="h-4 w-4" /> Upload My Own Diagram
        </button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="zone-search-upload-input" />
        {search && (
          <button type="button" className="flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--muted)] underline" disabled={loading} onClick={() => run(true)} data-testid="zone-search-again-btn">
            <RefreshCw className="h-3.5 w-3.5" /> Search again (1 Magic use)
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
