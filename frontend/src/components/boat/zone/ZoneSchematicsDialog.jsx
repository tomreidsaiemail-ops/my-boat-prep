import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Loader2, PencilLine, RefreshCw, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, API, apiError } from "@/lib/api";

const boatName = (b) => [b.make, b.model].map((s) => (s || "").trim()).filter(Boolean).join(" ");
export const zoneMapLabel = (b) => `Create ${(b.boat_type || "").trim() || "boat"} ZONE MAP OVERVIEWS for a ${boatName(b)}...`;
export const LAYOUT_EXAMPLE = "e.g. Owner's version, 3 cabins, galley on port, head in fore peak";

const boatBody = (b, comment, retry) => ({ boat_type: b.boat_type || "", make: b.make || "", model: b.model || "", year_built: b.year_built || "",
  loa: String(b.loa || ""), units: b.units === "ft" ? "ft" : "m", layout_comment: (comment || "").trim(), retry });
const saveComment = (layout_comment) => window.dispatchEvent(new CustomEvent("mbp:set-boat-fields", { detail: { layout_comment } }));

const CheckNote = ({ plan }) => {
  if (!plan.checked) return null;
  if (!plan.problems.length) {
    return <p className="flex items-start gap-2 rounded-md bg-emerald-50 p-2.5 text-sm font-bold text-emerald-900" data-testid="zone-plan-check-ok">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Checked against your layout comment: everything is where you said.</p>;
  }
  return (
    <div className="flex flex-col gap-1 rounded-md bg-amber-50 p-2.5 text-sm text-amber-950" data-testid="zone-plan-check-problems">
      <p className="flex items-start gap-2 font-bold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> The Magic Mariner couldn&apos;t fully match your comment:</p>
      {plan.problems.map((t, k) => <p key={k} className="pl-6" data-testid={`zone-plan-problem-${k}`}>{t}</p>)}
    </div>
  );
};

const Describe = ({ comment, setComment, onRedraw, onBack }) => (
  <div className="flex flex-col gap-2" data-testid="zone-plan-describe">
    <label htmlFor="zone-plan-comment" className="text-sm font-bold">Describe your boat&apos;s layout and the Magic Mariner will draw it again (1 Magic use).</label>
    <textarea id="zone-plan-comment" rows={3} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={LAYOUT_EXAMPLE}
      className="field-input min-h-[84px] py-2" data-testid="zone-plan-comment-input" />
    <div className="flex gap-2">
      <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onBack} data-testid="zone-plan-describe-back-btn">Back</button>
      <button type="button" className="btn-solid h-12 flex-[2] justify-center gap-2" disabled={!comment.trim()} onClick={onRedraw} data-testid="zone-plan-redraw-btn">
        <RefreshCw className="h-4 w-4" /> Redraw my layout
      </button>
    </div>
  </div>
);

// Magic Mariner: one labelled full-interior plan from make, model, year and the skipper's layout comment. The skipper confirms it
// matches their boat (it becomes a Zone Map Overview) or describes the layout and has it redrawn; every drawing is one Magic use.
export const ZoneSchematicsDialog = ({ open, boat, boatId, online, onDone, onClose }) => {
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState({ status: "idle", images: [] });
  const [comment, setComment] = useState(boat.layout_comment || "");
  const [describing, setDescribing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(null);
  const timer = useRef(null);
  const draw = async (text, retry = false) => {
    setError(""); setDescribing(false); setJob(null); setStatus({ status: "running", images: [] });
    if (!online) { setError("Drawing a layout plan needs a signal"); setStatus({ status: "idle", images: [] }); return; }
    try { setJob((await api.post(`/boats/${boatId}/zone-schematics`, boatBody(boat, text, retry), { timeout: 30000 })).data.job_id); }
    catch (e) { setError(apiError(e, "The Magic Mariner couldn't start the layout plan, please try again")); setStatus({ status: "idle", images: [] }); }
  };
  useEffect(() => {
    if (!open) { clearInterval(timer.current); setJob(null); return; }
    setComment(boat.layout_comment || "");
    draw(boat.layout_comment || "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!job) return undefined;
    const poll = () => api.get(`/zone-schematics/${job}`, { timeout: 15000 }).then(({ data }) => {
      setStatus(data);
      if (data.status !== "running") clearInterval(timer.current);
      if (data.status === "failed") setError("The Magic Mariner couldn't draw the plan this time. Your Magic use was given back, please try again.");
    }).catch(() => {});
    poll();
    timer.current = setInterval(poll, 3000);
    return () => clearInterval(timer.current);
  }, [job]);
  const redraw = () => { saveComment(comment.trim()); draw(comment, true); };
  const accept = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/boats/${boatId}/zone-schematics/${job}/use`, { image_ids: [status.images[0].id] });
      toast.success("Zone Map Overview added. Drag your colours onto it.");
      onDone(data.zone_maps);
    } catch (e) { toast.error(apiError(e, "Couldn't add the plan, please try again")); }
    setBusy(false);
  };
  const plan = status.images[0];
  const running = status.status === "running";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="zone-plans-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold"><Sparkles className="h-5 w-5 shrink-0" /> {zoneMapLabel(boat).replace(/\.\.\.$/, "")}</DialogTitle>
          <DialogDescription className="text-left text-xs">Magic Mariner · an AI-drawn plan from your make, model, year and layout comment, not the builder&apos;s official drawing.</DialogDescription>
        </DialogHeader>
        {comment.trim() && !describing && <p className="text-sm" data-testid="zone-plan-comment-used">Your layout comment: <b>{comment.trim()}</b></p>}
        {error && <div role="alert" className="flex flex-col gap-2 rounded-md bg-red-50 p-3 text-sm font-bold text-[var(--red)]" data-testid="zone-plans-error">{error}
          <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => draw(comment, true)} data-testid="zone-plans-retry-btn">Try again</button></div>}
        {running && (
          <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-[var(--line)] text-sm text-[var(--muted)]" data-testid="zone-plan-waiting">
            <Loader2 className="h-6 w-6 animate-spin" /> {comment.trim() ? "Drawing your layout and checking every zone against your comment. This can take up to 3 minutes." : "Drawing your layout plan. This takes about a minute."}
          </div>
        )}
        {plan && (
          <figure className="relative min-h-[200px] shrink-0 overflow-hidden rounded-md border-2 border-[var(--line)] bg-white" data-testid="zone-plan-0">
            <img src={`${API}/zone-schematics/${job}/${plan.id}`} alt={`${boatName(boat)} full interior layout plan`} onLoad={() => setShown(job)}
              className="max-h-[52vh] w-full object-contain" data-testid="zone-plan-image" />
            {shown !== job && <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-[var(--muted)]" data-testid="zone-plan-image-loading" />}
          </figure>
        )}
        {plan && <p className="text-xs text-[var(--muted)]" data-testid="zone-plan-orientation">Bow to the right, stern on the left: port along the top, starboard along the bottom.</p>}
        {plan && !describing && <>
          <CheckNote plan={plan} />
          <p className="text-base font-extrabold text-[var(--navy)]" data-testid="zone-plan-question">Does this match your boat&apos;s layout?</p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost h-12 flex-1 justify-center gap-2" onClick={() => setDescribing(true)} data-testid="zone-plan-no-btn"><PencilLine className="h-4 w-4" /> No</button>
            <button type="button" className="btn-solid h-12 flex-[2] justify-center gap-2" disabled={busy} onClick={accept} data-testid="zone-plan-yes-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Yes, use this plan
            </button>
          </div>
        </>}
        {describing && <Describe comment={comment} setComment={setComment} onRedraw={redraw} onBack={() => setDescribing(false)} />}
        {!plan && !describing && <button type="button" className="btn-ghost h-12 justify-center" onClick={onClose} data-testid="zone-plans-cancel-btn">Cancel</button>}
      </DialogContent>
    </Dialog>
  );
};
