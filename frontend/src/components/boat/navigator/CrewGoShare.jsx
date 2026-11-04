import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Loader2, Send, UserPlus, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

export const nowText = () => new Date().toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const timeText = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

const Status = ({ answer }) => {
  if (!answer) return <span className="flex items-center gap-1 text-xs font-bold text-[var(--muted)]"><Clock className="h-3.5 w-3.5" /> Waiting</span>;
  return answer.agree
    ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><Check className="h-3.5 w-3.5" /> Agreed {timeText(answer.at)}</span>
    : <span className="flex items-center gap-1 text-xs font-bold text-[var(--red)]"><X className="h-3.5 w-3.5" /> Not agreed {timeText(answer.at)}</span>;
};

// Skipper side on Route Planning: one tap shares the route, weather photos and why-we're-going; shows each crew member's answer.
export const CrewGoShare = ({ boat, boatId, online, onWeather }) => {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const w = boat.weather || {};
  const photos = w.photos || [];
  const load = () => online && api.get(`/boats/${boatId}/go-plan`, { timeout: 15000 }).then(({ data }) => setInfo(data)).catch(() => {});
  useEffect(() => { load(); }, [online, boatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setConfirm(false);
    if (!online) { toast.error("Sending to the crew needs a signal"); return; }
    setBusy(true);
    try {
      await api.post(`/boats/${boatId}/go-plan`, { start: boat.route_start || "", dest: boat.route_dest || "", why: (w.why || "").slice(0, 1000),
        photos: photos.slice(0, 5).map((p) => ({ id: p.id, note: (p.note || "").slice(0, 300) })), when: nowText() });
      // Shared photos stay stored even if the skipper later removes them from Route Planning.
      if (photos.length) onWeather({ photos: photos.map((p) => ({ ...p, shared: true })) });
      toast.success("Sent to the crew. Their answers will appear here and in the Ship's Log.");
      load();
    } catch (e) { toast.error(apiError(e, "Couldn't send to the crew, please try again")); }
    setBusy(false);
  };
  const people = [...(info?.crew || []), ...(info?.pending || []).map((p) => ({ ...p, pending: true }))];
  const agreed = (info?.crew || []).filter((c) => c.answer?.agree).length;
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--navy)] bg-white p-3" data-testid="crew-go-share">
      <h4 className="text-sm font-extrabold uppercase tracking-wide">Crew decision to go</h4>
      <p className="text-xs text-[var(--muted)]">Shares the route, the weather and routing photos and why you're going. Each crew member agrees (or says why not) in the app, and every answer goes in the Ship's Log.</p>
      <button type="button" className="btn-solid min-h-11 w-full gap-2" disabled={busy} onClick={() => (info?.plan ? setConfirm(true) : send())} data-testid="crew-go-send-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {info?.plan ? "Send the updated plan to the crew" : "Send to crew"}
      </button>
      {info?.plan && (
        <div className="flex flex-col gap-1.5" data-testid="crew-go-status">
          <p className="text-xs font-bold">Sent {timeText(info.plan.sent_at)} · {agreed} of {(info.crew || []).length} crew agreed</p>
          {!people.length && <p className="text-xs text-[var(--muted)]" data-testid="crew-go-no-crew">No crew yet. Invite crew from the Crew list and they'll see it when they join.</p>}
          <ul className="flex flex-col gap-1">
            {people.map((p) => (
              <li key={p.user_id || p.invite_id} className="flex flex-col rounded-md bg-[var(--panel)] px-2.5 py-1.5" data-testid={`crew-go-person-${p.user_id || p.invite_id}`}>
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="min-w-0 truncate">{p.name}</span>
                  {p.pending ? <span className="flex items-center gap-1 text-xs font-bold text-[var(--muted)]"><UserPlus className="h-3.5 w-3.5" /> Not joined yet</span> : <Status answer={p.answer} />}
                </span>
                {p.answer && !p.answer.agree && <span className="text-xs text-[var(--red)]" data-testid={`crew-go-reason-${p.user_id}`}>{p.answer.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ConfirmDelete item={confirm ? { name: "the updated plan" } : null} testId="crew-go-resend" title="Send the updated plan?" confirmLabel="Send and ask again" cancelLabel="Not yet"
        note="Everyone will be asked to agree again. Earlier answers stay in the Ship's Log." danger={false} onConfirm={send} onClose={() => setConfirm(false)} />
    </section>
  );
};
