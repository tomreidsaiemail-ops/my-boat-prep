import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Compass, Loader2, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Img } from "@/components/boat/PhotoSlots";
import { weatherUrl } from "@/components/boat/navigator/WeatherPhotos";
import { nowText } from "@/components/boat/navigator/CrewGoShare";

const route = (p) => [p.start, p.dest].filter(Boolean).join(" to ");

// Crew side: the skipper's decision to go, with Agree / Not agreed (reason required). Each answer is logged in the Ship's Log.
export const GoDecisionCard = ({ boat, online }) => {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState("");
  const [saying, setSaying] = useState(false);
  const [reason, setReason] = useState("");
  const params = { owner_id: boat.owner_id, boat_id: boat.boat_id };
  const load = () => api.get("/crew/go-plan", { params, timeout: 10000 }).then(({ data }) => setInfo(data)).catch(() => {});
  useEffect(() => {
    if (!online) { setInfo(null); return undefined; }
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [online, boat.owner_id, boat.boat_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = info?.plan;
  if (!plan) return null;
  const answer = info.answer?.plan_id === plan.plan_id ? info.answer : null;
  const reply = async (agree) => {
    if (!online) { toast.error("Go online to answer the skipper"); return; }
    if (!agree && !reason.trim()) { toast.error("Please say why you don't agree"); return; }
    setBusy(agree ? "yes" : "no");
    try {
      const { data } = await api.post("/crew/go-plan/answer", { ...params, plan_id: plan.plan_id, agree, reason: agree ? "" : reason.trim(), when: nowText() });
      setInfo((i) => ({ ...i, answer: data.answer }));
      setSaying(false); setReason("");
      toast.success(agree ? "You agreed to go. It's in the Ship's Log." : "Your concern has been sent to the skipper and logged.");
    } catch (e) { toast.error(apiError(e, "Couldn't send your answer, please try again")); if (e?.response?.status === 409) load(); }
    setBusy("");
  };
  const url = weatherUrl(boat.boat_id, boat.owner_id);
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border-[1.5px] border-[var(--navy)] bg-white p-3.5" data-testid="go-decision-card">
      <h2 className="flex items-center gap-2 font-display text-base font-extrabold uppercase tracking-tight"><Compass className="h-4 w-4" /> Decision to go</h2>
      {route(plan) && <p className="text-sm font-bold" data-testid="go-decision-route">{route(plan)}</p>}
      {plan.why && <p className="whitespace-pre-line text-sm leading-relaxed" data-testid="go-decision-why"><span className="field-label block">Why we're going</span>{plan.why}</p>}
      {plan.photos?.length > 0 && (
        <div className="grid grid-cols-2 gap-2" data-testid="go-decision-photos">
          {plan.photos.map((p, n) => (
            <figure key={p.id} className="flex flex-col gap-1">
              <Img url={url(p.id)} alt={`Weather and routing photo ${n + 1}`} className="aspect-[4/3] w-full rounded-md border" />
              {p.note && <figcaption className="text-xs text-[var(--muted)]">{p.note}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {answer && (
        <p className={`rounded-md px-3 py-2 text-sm font-bold ${answer.agree ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-[var(--red)]"}`} data-testid="go-decision-answer">
          {answer.agree ? "You agreed to go." : `You didn't agree: ${answer.reason.replace(/[.!?]*$/, ".")}`} You can change your answer.
        </p>
      )}
      {saying && (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} autoFocus placeholder="Why don't you agree? e.g. The swell forecast looks too big for the crossing"
            className="field-input min-h-[80px] resize-y py-2 text-base leading-snug" data-testid="go-decision-reason-input" />
          <button type="button" onClick={() => { setSaying(false); setReason(""); }} className="self-start text-xs font-bold underline" data-testid="go-decision-reason-cancel-btn">Cancel</button>
        </>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={!!busy} onClick={() => reply(true)} data-testid="go-decision-agree-btn"
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-md border-2 text-sm font-bold ${answer?.agree ? "border-emerald-700 bg-emerald-700 text-white" : "border-[var(--navy)] bg-white text-[var(--navy)]"}`}>
          {busy === "yes" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Agree to go
        </button>
        <button type="button" disabled={!!busy} onClick={() => (saying ? reply(false) : setSaying(true))} data-testid="go-decision-disagree-btn"
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-md border-2 text-sm font-bold ${answer && !answer.agree ? "border-[var(--red)] bg-[var(--red)] text-white" : "border-[var(--navy)] bg-white text-[var(--navy)]"}`}>
          {busy === "no" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} {saying ? "Send reason" : "Not agreed"}
        </button>
      </div>
    </section>
  );
};
