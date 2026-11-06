import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, API, apiError } from "@/lib/api";
import { LinkedText } from "@/components/boat/LinkedText";
import useAdminLists from "@/hooks/useAdminLists";

const HELP_NAME = "admin - help panel - zone map selection";
const boatName = (b) => [b.make, b.model].map((s) => (s || "").trim()).filter(Boolean).join(" ");
export const zoneMapLabel = (b) => `Create ${(b.boat_type || "").trim() || "boat"} ZONE MAP OVERVIEWS for a ${boatName(b)}...`;

const Help = ({ online, boat }) => {
  const help = useAdminLists("Admin - Help Panel - ", online).find((l) => l.name.toLowerCase().replace(/\s+/g, " ").trim() === HELP_NAME)?.items;
  return (
    <div className="flex flex-col gap-1 rounded-md bg-sky-50 p-3 text-sm" data-testid="zone-plans-help">
      {help?.length ? help.map((i, k) => (
        <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""}><LinkedText text={i.label} testId={`zone-plans-help-link-${k}`} /></p>
      )) : <p data-testid="zone-plans-help-default">The Magic Mariner is drawing top-down layout plans of a {boatName(boat)}. Select a couple that help you map out your cockpit, saloon, galley and cabins, then tap Continue. They become Zone Map Overviews, where you drag your colours onto each area.</p>}
    </div>
  );
};

const Plan = ({ job, img, on, onToggle }) => (
  <button type="button" onClick={onToggle} aria-pressed={on} data-testid={`zone-plan-${img.id}`}
    className={`relative flex flex-col overflow-hidden rounded-md border-2 bg-white text-left [transition:border-color_.15s] ${on ? "border-[var(--navy)]" : "border-[var(--line)]"}`}>
    <img src={`${API}/zone-schematics/${job}/${img.id}`} alt={`${img.title} layout plan`} className="aspect-[16/10] w-full object-contain" />
    <span className="px-2 py-1.5 text-xs font-bold">{img.title}</span>
    {on && <CheckCircle2 className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full bg-white text-[var(--green)]" data-testid={`zone-plan-${img.id}-ticked`} />}
  </button>
);

// Magic Mariner layout plans for the boat's make and model; the picked ones become the boat's first zone maps.
export const ZoneSchematicsDialog = ({ open, boat, boatId, online, onDone, onClose }) => {
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState({ status: "idle", images: [], total: 4, failed: 0 });
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);
  const start = async () => {
    setError(""); setPicked([]); setJob(null); setStatus({ status: "running", images: [], total: 4, failed: 0 });
    if (!online) { setError("Drawing layout plans needs a signal"); setStatus((s) => ({ ...s, status: "idle" })); return; }
    try {
      const { data } = await api.post(`/boats/${boatId}/zone-schematics`, { boat_type: boat.boat_type || "", make: boat.make || "", model: boat.model || "",
        year_built: boat.year_built || "", loa: String(boat.loa || ""), units: boat.units === "ft" ? "ft" : "m" }, { timeout: 30000 });
      setJob(data.job_id);
    } catch (e) { setError(apiError(e, "The Magic Mariner couldn't start the layout plans, please try again")); setStatus((s) => ({ ...s, status: "idle" })); }
  };
  useEffect(() => { if (open) start(); else { clearInterval(timer.current); setJob(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!job) return undefined;
    const poll = () => api.get(`/zone-schematics/${job}`, { timeout: 15000 }).then(({ data }) => {
      setStatus(data);
      if (data.status !== "running") clearInterval(timer.current);
      if (data.status === "failed") setError("The Magic Mariner couldn't draw the plans this time. Your Magic use was given back, please try again.");
    }).catch(() => {});
    poll();
    timer.current = setInterval(poll, 3000);
    return () => clearInterval(timer.current);
  }, [job]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const finish = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/boats/${boatId}/zone-schematics/${job}/use`, { image_ids: picked });
      toast.success(`${picked.length} Zone Map ${picked.length === 1 ? "Overview" : "Overviews"} added. Drag your colours onto them.`);
      onDone(data.zone_maps);
    } catch (e) { toast.error(apiError(e, "Couldn't add the plans, please try again")); }
    setBusy(false);
  };
  const waiting = status.status === "running" ? Math.max(0, status.total - status.images.length - status.failed) : 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="zone-plans-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold"><Sparkles className="h-5 w-5 shrink-0" /> {zoneMapLabel(boat).replace(/\.\.\.$/, "")}</DialogTitle>
          <DialogDescription className="text-left text-xs">Magic Mariner · AI-drawn plans based on the builder's published layouts, not the official drawings.</DialogDescription>
        </DialogHeader>
        <Help online={online} boat={boat} />
        {error && <div role="alert" className="flex flex-col gap-2 rounded-md bg-red-50 p-3 text-sm font-bold text-[var(--red)]" data-testid="zone-plans-error">{error}
          <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={start} data-testid="zone-plans-retry-btn">Try again</button></div>}
        <div className="grid grid-cols-2 gap-2" data-testid="zone-plans-grid">
          {status.images.map((img) => <Plan key={img.id} job={job} img={img} on={picked.includes(img.id)} onToggle={() => toggle(img.id)} />)}
          {Array.from({ length: waiting }, (_, k) => (
            <div key={`w${k}`} className="flex aspect-[16/12] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-[var(--line)] text-xs text-[var(--muted)]" data-testid="zone-plan-waiting">
              <Loader2 className="h-5 w-5 animate-spin" /> Drawing...
            </div>
          ))}
        </div>
        {status.status === "running" && <p className="text-xs text-[var(--muted)]" data-testid="zone-plans-progress">Drawing {status.images.length} of {status.total} plans. This takes about a minute.</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} data-testid="zone-plans-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-[2] justify-center gap-2" disabled={!picked.length || busy} onClick={finish} data-testid="zone-plans-continue-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {picked.length ? `Continue with ${picked.length}` : "Select 1 or more plans"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
