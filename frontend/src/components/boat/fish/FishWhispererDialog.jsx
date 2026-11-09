import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CloudOff, Fish, Loader2, MapPin, RotateCcw, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { MagicHelp } from "@/components/boat/MagicHelp";
import { FishReport } from "@/components/boat/fish/FishReport";
import { CatchLog } from "@/components/boat/fish/CatchLog";
import { FishQueue, catchForm } from "@/components/boat/fish/FishQueue";
import { queueCatch } from "@/lib/fishQueue";
import { useAuth } from "@/context/AuthContext";

const HELP = [
  "The Magic Fish Whisperer... is here to help you figure the species of fish you have caught and to use your GPS and give you some local fishing knowledge.",
  "In particular, The Magic Fish Whisperer, will give you important information sources to help you to stay informed.",
  "The Magic Fish Whisperer can also give you some help filleting those strange species and if you need to watch out for things like puffer fish poison.",
  "Always double check with your local authorities but The Magic Fish Whisperer can help get you started the right questions to ask. It will give you a good estimate of fish length, and an estimated weight.",
];

const Tab = ({ on, onClick, testId, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId}
    className={`h-10 flex-1 rounded-md text-sm font-bold [transition:background-color_.15s] ${on ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)] hover:bg-slate-50"}`}>{children}</button>
);

export const FishWhispererDialog = ({ open, online, gps, imperial, helpItems, logParams, onLogged, onClose }) => {
  const input = useRef(null);
  const [tab, setTab] = useState("new");
  const [shot, setShot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(null);
  const [logKey, setLogKey] = useState(0);
  const [queueKey, setQueueKey] = useState(0);
  const { user } = useAuth();
  const reset = () => { if (shot?.preview) URL.revokeObjectURL(shot.preview); setShot(null); setResult(null); };
  const close = () => { if (busy) return; reset(); setTab("new"); onClose(); };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a photo"); return; }
    reset();
    const at = new Date();
    setShot({ blob, preview: URL.createObjectURL(blob), at: at.toISOString(), gps: gps?.status === "ok" ? gps : null,
      when: at.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) });
  };
  // Everything the Whisperer needs, captured now: the photo, where and when it was taken, and the boat whose log it goes in.
  const snapshot = () => ({
    blob: shot.blob, user_id: user?.user_id, taken_at: shot.at, when: shot.when,
    ...(shot.gps ? { lat: shot.gps.lat, lon: shot.gps.lon, position: shot.gps.text } : {}),
    ...(logParams?.boat_id ? { boat_id: logParams.boat_id, owner_id: logParams.owner_id || "" } : {}),
  });
  const saveForLater = async () => {
    try { await queueCatch(snapshot()); } catch { toast.error("Couldn't save the photo on this phone"); return; }
    toast.success("Saved with its GPS and time. Tap Identify queued catches when you have a signal.", { duration: 3500, position: "top-center" });
    reset(); setQueueKey((k) => k + 1);
  };
  const ask = async () => {
    if (!online) { saveForLater(); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/ai/fish", catchForm(snapshot()), { timeout: 150000 });
      if (data.not_fish) toast.error(data.message, { duration: 8000 });
      else {
        setResult(data.catch); setLogKey((k) => k + 1);
        toast.success(`${data.catch.report.species.common_name} saved to your catch log${data.log_item ? " and the Ship's Log" : ""}`);
        if (data.log_item) onLogged(data.log_item);
      }
    } catch (err) {
      if (!err.response) { setBusy(false); saveForLater(); return; }
      toast.error(apiError(err, "The Magic Fish Whisperer couldn't look at that photo. Please try again."));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid="fish-dialog"
        onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><Fish className="h-5 w-5" /> Magic Fish Whisperer...</DialogTitle>
          <DialogDescription className="sr-only">Photo your catch and the Magic Fish Whisperer names the species and gives local fishing advice.</DialogDescription>
        </DialogHeader>
        <MagicHelp storageKey="mbp_help_fish" title="How the Magic Fish Whisperer works" items={helpItems} fallback={HELP} testId="fish-help" />
        <div className="flex gap-1 rounded-lg bg-[var(--panel)] p-1">
          <Tab on={tab === "new"} onClick={() => setTab("new")} testId="fish-tab-new">New catch</Tab>
          <Tab on={tab === "log"} onClick={() => setTab("log")} testId="fish-tab-log">Catch log{count ? ` (${count})` : ""}</Tab>
          <Tab on={tab === "map"} onClick={() => setTab("map")} testId="fish-tab-map">Catch map</Tab>
        </div>
        {tab === "new" && <FishQueue userId={user?.user_id} online={online} imperial={imperial} refreshKey={queueKey} onLogged={onLogged} onIdentified={() => setLogKey((k) => k + 1)} />}
        <div className={tab === "new" ? "hidden" : ""}><CatchLog online={online} imperial={imperial} refreshKey={logKey} onCount={setCount} view={tab === "map" ? "map" : "list"} /></div>
        {tab === "new" && (result ? (
          <>
            <FishReport c={result} imperial={imperial} preview={shot?.preview} />
            <button type="button" className="btn-ghost h-12 justify-center gap-2" onClick={reset} data-testid="fish-another-btn"><Camera className="h-4 w-4" /> Photo another fish</button>
          </>
        ) : (
          <>
            <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} data-testid="fish-photo-input" />
            {shot ? (
              <div className="flex flex-col gap-2" data-testid="fish-photo-preview">
                <img src={shot.preview} alt="Your catch" className="max-h-72 w-full rounded-lg border-[1.5px] border-[var(--line)] object-contain" />
                <button type="button" className="btn-ghost h-10 justify-center gap-1.5 text-sm" onClick={() => input.current?.click()} disabled={busy} data-testid="fish-retake-btn"><RotateCcw className="h-4 w-4" /> Retake</button>
              </div>
            ) : (
              <button type="button" onClick={() => input.current?.click()} data-testid="fish-photo-btn"
                className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-slate-50 px-4 text-center text-sm font-bold [transition:background-color_.15s] hover:bg-sky-50">
                <Camera className="h-10 w-10" /> Tap to take a photo of your fish or shellfish
                <span className="text-xs font-semibold text-[var(--muted)]">The whole catch, side-on for fish, with your hand or something for scale</span>
              </button>
            )}
            <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]" data-testid="fish-gps">
              <MapPin className="h-4 w-4 shrink-0" /> {(shot ? shot.gps : gps?.status === "ok" ? gps : null) ? `${shot ? "Taken at" : "Using your GPS:"} ${(shot?.gps || gps).text}` : "GPS position unavailable, so local rules will be general"}
            </p>
            <button type="button" className="btn-solid h-12 justify-center gap-2 disabled:opacity-40" onClick={ask} disabled={!shot || busy} data-testid="fish-ask-btn">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Whispering to your catch...</>
                : online ? <><Sparkles className="h-4 w-4" /> Identify my catch</> : <><CloudOff className="h-4 w-4" /> No signal: save to identify later</>}
            </button>
          </>
        ))}
      </DialogContent>
    </Dialog>
  );
};
