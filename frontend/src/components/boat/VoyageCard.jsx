import { LinkedText } from "@/components/boat/LinkedText";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Map as MapIcon, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RotaList } from "@/components/boat/RotaList";

export const VoyageCard = ({ boat, online }) => {
  const { user } = useAuth();
  const [voyage, setVoyage] = useState(null);
  const [busy, setBusy] = useState("");
  const params = { owner_id: boat.owner_id, boat_id: boat.boat_id };

  useEffect(() => {
    setVoyage(null);
    if (!online) return;
    const load = () => api.get("/crew/voyage", { params, timeout: 10000 }).then(({ data }) => setVoyage(data)).catch(() => {});
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [online, boat.owner_id, boat.boat_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!voyage?.notes && !voyage?.rota) return null;
  const reply = async (status) => {
    if (!online) { toast.error("Go online to reply to the skipper"); return; }
    setBusy(status);
    try {
      await api.post("/crew/rsvp", { ...params, status });
      setVoyage((v) => ({ ...v, rsvp: status }));
      toast.success(status === "in" ? "The skipper can see you're in" : "The skipper can see you can't make it");
    } catch (e) { toast.error(apiError(e, "Couldn't send your reply, please try again")); }
    finally { setBusy(""); }
  };
  const Btn = ({ status, icon: Icon, children, on }) => (
    <button type="button" onClick={() => reply(status)} disabled={!!busy} aria-pressed={voyage.rsvp === status} data-testid={`voyage-rsvp-${status}-btn`}
      className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-md border-2 text-sm font-bold [transition:background-color_.15s,color_.15s] ${voyage.rsvp === status ? on : "border-[var(--navy)] bg-white text-[var(--navy)]"}`}>
      {busy === status ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {children}
    </button>
  );
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border-[1.5px] border-[var(--navy)] bg-white p-3.5" data-testid="voyage-card">
      <h2 className="flex items-center gap-2 font-display text-base font-extrabold uppercase tracking-tight"><MapIcon className="h-4 w-4" /> Planned voyage</h2>
      {voyage.notes && (
        <>
          <p className="whitespace-pre-line text-sm leading-relaxed" data-testid="voyage-notes-text"><LinkedText text={voyage.notes} testId="voyage-notes" /></p>
          <div className="flex gap-2">
            <Btn status="in" icon={Check} on="border-emerald-700 bg-emerald-700 text-white">I'm in</Btn>
            <Btn status="out" icon={X} on="border-[var(--red)] bg-[var(--red)] text-white">Can't make it</Btn>
          </div>
        </>
      )}
      {voyage.rota && (
        <div className="flex flex-col gap-1.5" data-testid="voyage-rota">
          <p className="field-label">Watch rota <span className="normal-case tracking-normal text-[var(--muted)]">· your watches are highlighted</span></p>
          <RotaList rota={voyage.rota} me={user?.user_id} testId="voyage-rota-list" />
        </div>
      )}
    </section>
  );
};
