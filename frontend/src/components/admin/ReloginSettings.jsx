import { useEffect, useState } from "react";
import { CalendarClock, Loader2, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, apiError } from "@/lib/api";
import { CHECK_EVENT } from "@/lib/appUpdate";

const WHEN = { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false };
const fmt = (iso) => new Date(iso).toLocaleString("en-NZ", WHEN);

// Admin: sign everyone out for a major update, now or at a scheduled outage window.
export const ReloginSettings = () => {
  const [cur, setCur] = useState(null);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { api.get("/admin/relogin").then(({ data }) => setCur(data)).catch(() => setCur({ error: true })); }, []);
  if (!cur) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (cur.error) return <p className="text-sm text-[var(--red)]">Couldn't load the sign-out settings.</p>;
  const upcoming = cur.relogin_at && new Date(cur.relogin_at) > new Date();
  const save = async (at) => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/relogin", { at, note });
      setCur(data);
      setWhen("");
      window.dispatchEvent(new Event(CHECK_EVENT));
      toast.success(at ? `Everyone will be signed out ${fmt(data.relogin_at)}` : "Everyone is being signed out now");
    } catch (e) { toast.error(apiError(e, "Couldn't save")); } finally { setBusy(false); setConfirm(null); }
  };
  const cancel = async () => {
    setBusy(true);
    try { setCur(await api.delete("/admin/relogin").then((r) => r.data)); toast.success("Scheduled sign-out cancelled"); }
    catch (e) { toast.error(apiError(e, "Couldn't cancel")); } finally { setBusy(false); }
  };
  const ask = (at) => setConfirm({ at, text: at ? `Everyone will be shown a notice now and signed out on ${fmt(at)}.` : "Everyone, including you, gets a one-minute countdown and then signs in again." });
  return (
    <section className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-4" data-testid="relogin-settings">
      <h2 className="text-base font-extrabold">Sign everyone out for a major update</h2>
      <p className="text-xs text-[var(--muted)]">Skippers, crew and Shore Contacts get a one-minute countdown, their unsaved changes sync first, then they sign in again. Normal updates don't need this: phones just pick up the new version.</p>
      {cur.relogin_at && (
        <p className="flex items-center gap-2 text-sm font-bold" data-testid="relogin-current">
          <CalendarClock className="h-4 w-4 shrink-0" />{upcoming ? "Scheduled" : "Last sign-out"}: {fmt(cur.relogin_at)}{cur.note ? ` – ${cur.note}` : ""}
          {upcoming && <button type="button" className="ml-auto flex items-center gap-1 text-[var(--red)] underline" disabled={busy} onClick={cancel} data-testid="relogin-cancel-btn"><X className="h-4 w-4" />Cancel</button>}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-bold">Outage window starts
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field-input h-11" data-testid="relogin-when-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">Message (optional)
        <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New crew features, about 10 minutes" className="field-input h-11" data-testid="relogin-note-input" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-solid px-5" disabled={busy || !when} onClick={() => ask(new Date(when).toISOString())} data-testid="relogin-schedule-btn"><CalendarClock className="h-4 w-4" />Schedule</button>
        <button type="button" className="btn-ghost px-5 text-[var(--red)]" disabled={busy} onClick={() => ask(null)} data-testid="relogin-now-admin-btn"><LogOut className="h-4 w-4" />Sign everyone out now</button>
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent className="max-w-md" data-testid="relogin-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign everyone out?</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="relogin-confirm-cancel-btn">Back</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); save(confirm.at); }} data-testid="relogin-confirm-btn">Yes, sign everyone out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
