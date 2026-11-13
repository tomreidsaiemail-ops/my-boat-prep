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

const Layout = ({ job, img, onPick, busy }) => (
  <button type="button" onClick={onPick} disabled={busy} data-testid={`zone-layout-${img.id}`}
    className="flex flex-col overflow-hidden rounded-md border-2 border-[var(--line)] bg-white text-left [transition:border-color_.15s] hover:border-[var(--navy)] disabled:opacity-60">
    <img src={`${API}/zone-schematics/${job}/${img.id}`} alt={`${img.title} plan`} className="aspect-[16/10] w-full object-contain" />
    <span className="px-2 pt-1.5 text-sm font-extrabold text-[var(--navy)]" data-testid={`zone-layout-${img.id}-label`}>{img.title}</span>
    {img.summary && <span className="px-2 pb-1.5 text-xs text-[var(--muted)]">{img.summary}</span>}
  </button>
);

const boatBody = (b) => ({ boat_type: b.boat_type || "", make: b.make || "", model: b.model || "", year_built: b.year_built || "", loa: String(b.loa || ""), units: b.units === "ft" ? "ft" : "m" });
const saveLayout = (layout, detail) => window.dispatchEvent(new CustomEvent("mbp:set-boat-fields", { detail: { layout, layout_detail: detail } }));

// Magic Mariner: first the model's factory layouts (up to 4, labelled) to pick from, then the 4 layout plans of the picked one,
// all for one Magic use. A boat with a layout already chosen goes straight to its plans; Change layout shows the layouts again.
export const ZoneSchematicsDialog = ({ open, boat, boatId, online, onDone, onClose }) => {
  const [stage, setStage] = useState("layouts");
  const [layoutsJob, setLayoutsJob] = useState(null);
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState({ status: "idle", images: [], total: 4, failed: 0 });
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);
  const run = async (path, body, fail) => {
    setError(""); setPicked([]); setJob(null); setStatus({ status: "running", images: [], total: 4, failed: 0 });
    if (!online) { setError("Drawing layout plans needs a signal"); setStatus((s) => ({ ...s, status: "idle" })); return null; }
    try {
      const { data } = await api.post(path, body, { timeout: 30000 });
      setJob(data.job_id);
      return data.job_id;
    } catch (e) { setError(apiError(e, fail)); setStatus((s) => ({ ...s, status: "idle" })); return null; }
  };
  const showLayouts = async () => {
    setStage("layouts");
    setLayoutsJob(await run(`/boats/${boatId}/zone-layouts`, boatBody(boat), "The Magic Mariner couldn't look up the layouts, please try again"));
  };
  const drawPlans = (layout, detail, fromJob) => {
    setStage("plans");
    run(`/boats/${boatId}/zone-schematics`, { ...boatBody(boat), layout: layout || "", layout_detail: detail || "", layouts_job: fromJob || "" }, "The Magic Mariner couldn't start the layout plans, please try again");
  };
  const pickLayout = (img) => { saveLayout(img.title, img.summary || ""); drawPlans(img.title, img.summary, layoutsJob); };
  useEffect(() => {
    if (!open) { clearInterval(timer.current); setJob(null); return; }
    if (boat.layout) drawPlans(boat.layout, boat.layout_detail); else showLayouts();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
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
      toast.success(`${picked.length} Zone Map ${picked.length === 1 ? "Overview" : "Overviews"} added. Drag your colours onto ${picked.length === 1 ? "it" : "them"}.`);
      onDone(data.zone_maps);
    } catch (e) { toast.error(apiError(e, "Couldn't add the plans, please try again")); }
    setBusy(false);
  };
  const layouts = stage === "layouts";
  const waiting = status.status === "running" ? Math.max(0, status.total - status.images.length - status.failed) : 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="zone-plans-dialog" data-stage={stage}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold"><Sparkles className="h-5 w-5 shrink-0" /> {zoneMapLabel(boat).replace(/\.\.\.$/, "")}</DialogTitle>
          <DialogDescription className="text-left text-xs">Magic Mariner · AI-drawn plans based on the builder's published layouts, not the official drawings.</DialogDescription>
        </DialogHeader>
        {layouts
          ? <p className="rounded-md bg-sky-50 p-3 text-sm" data-testid="zone-layouts-help">The {boatName(boat)} came in {status.status === "running" && !status.images.length ? "one or more" : status.total === 1 ? "one" : `${status.total}`} factory {status.total === 1 ? "layout" : "layouts"}. Tap the one that matches your boat, and the Magic Mariner draws its deck, saloon & galley, cabins and full interior plans (no extra Magic use).</p>
          : <>
            {boat.layout && <p className="flex flex-wrap items-baseline gap-x-2 text-sm" data-testid="zone-plans-layout">Layout: <b>{boat.layout}</b>
              <button type="button" className="text-xs font-bold text-[var(--navy)] underline underline-offset-2" onClick={showLayouts} data-testid="zone-plans-change-layout-btn">Change layout</button></p>}
            <Help online={online} boat={boat} />
          </>}
        {error && <div role="alert" className="flex flex-col gap-2 rounded-md bg-red-50 p-3 text-sm font-bold text-[var(--red)]" data-testid="zone-plans-error">{error}
          <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => (layouts ? showLayouts() : drawPlans(boat.layout, boat.layout_detail))} data-testid="zone-plans-retry-btn">Try again</button></div>}
        <div className={`grid gap-2 ${layouts ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`} data-testid={layouts ? "zone-layouts-grid" : "zone-plans-grid"}>
          {status.images.map((img) => (layouts
            ? <Layout key={img.id} job={job} img={img} busy={!job} onPick={() => pickLayout(img)} />
            : <Plan key={img.id} job={job} img={img} on={picked.includes(img.id)} onToggle={() => toggle(img.id)} />))}
          {Array.from({ length: waiting }, (_, k) => (
            <div key={`w${k}`} className="flex aspect-[16/12] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-[var(--line)] text-xs text-[var(--muted)]" data-testid="zone-plan-waiting">
              <Loader2 className="h-5 w-5 animate-spin" /> {layouts ? "Checking layouts..." : "Drawing..."}
            </div>
          ))}
        </div>
        {status.status === "running" && <p className="text-xs text-[var(--muted)]" data-testid="zone-plans-progress">{layouts ? `Drawing ${status.images.length} of ${status.total} layouts.` : `Drawing ${status.images.length} of ${status.total} plans.`} This takes about a minute.</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} data-testid="zone-plans-cancel-btn">Cancel</button>
          {!layouts && (
            <button type="button" className="btn-solid h-12 flex-[2] justify-center gap-2" disabled={!picked.length || busy} onClick={finish} data-testid="zone-plans-continue-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {picked.length ? `Continue with ${picked.length}` : "Select 1 or more plans"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
