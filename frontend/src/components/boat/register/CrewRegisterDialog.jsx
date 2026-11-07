import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { requestMessage, waLink } from "@/lib/crewRegister";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { RegRow } from "@/components/boat/register/RegRow";
import { RegEntryDialog } from "@/components/boat/register/RegEntryDialog";
import { EmailPartiesButton } from "@/components/boat/register/EmailPartiesButton";

const Section = ({ title, hint, empty, rows, testId, children }) => (
  <section className="flex flex-col gap-2" data-testid={testId}>
    <div>
      <h3 className="font-display text-base font-extrabold">{title}</h3>
      <p className="text-xs text-[var(--muted)]">{hint}</p>
    </div>
    <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)]" data-testid={`${testId}-list`}>
      {rows.length === 0 && <li className="p-3 text-sm text-[var(--muted)]" data-testid={`${testId}-empty`}>{empty}</li>}
      {children}
    </ul>
  </section>
);

export const CrewRegisterDialog = ({ open, boatId, online, premium, onUpgrade, onClose }) => {
  const { user } = useAuth();
  const [reg, setReg] = useState({ crew: [], parties: [] });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState({});
  const load = useCallback(() => api.get("/crew-register").then(({ data }) => setReg(data)).catch(() => {}), []);
  useEffect(() => { if (open && online) load(); }, [open, online, load]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (!online) { toast.error("Go online to refresh your crew register"); return; }
    setRefreshing(true);
    window.dispatchEvent(new Event("mbp:refresh-boat"));
    window.dispatchEvent(new Event("mbp:register-changed"));
    await load();
    setRefreshing(false);
    toast.success("Crew registrations and role briefings refreshed");
  };

  const guard = () => {
    if (!online) { toast.error("Go online to change your crew register"); return false; }
    return true;
  };
  const request = async (ids, sendEmail, key) => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { toast.error("Go online to send registration requests"); return; }
    setBusy((b) => ({ ...b, [key]: "email" }));
    try {
      const { data } = await api.post("/crew-register/requests", { entry_ids: ids, send_email: sendEmail, boat_id: boatId }, { timeout: 90000 });
      if (sendEmail && data.sent.length) toast.success(`Registration request emailed to ${data.sent.join(", ")}`);
      if (sendEmail && !data.sent.length) toast.message("Everyone on your crew list is already registered");
      load();
    } catch (err) { toast.error(apiError(err, "Couldn't send the request, please try again")); }
    finally { setBusy((b) => ({ ...b, [key]: "" })); }
  };
  const whatsApp = (e) => {
    if (!premium) { onUpgrade(); return; }
    const text = requestMessage({ name: e.name, skipper: user.name || user.email, email: e.email });
    if (e.phone && /\d{6,}/.test(e.phone.replace(/[^\d]/g, ""))) window.open(waLink(e.phone, text), "_blank", "noopener");
    else navigator.clipboard?.writeText(text).then(() => toast.success("No phone number saved, so the message is copied. Paste it into WhatsApp."), () => toast.error("Add their phone number to send by WhatsApp"));
    request([e.entry_id], false, e.entry_id);
  };
  const remove = async () => {
    const e = deleting; setDeleting(null);
    if (!guard()) return;
    try { await api.delete(`/crew-register/${e.entry_id}`); toast.success(`${e.name} removed`); load(); } catch (err) { toast.error(apiError(err)); }
  };
  const add = (kind) => { if (guard()) setEditing({ kind }); };
  const waiting = reg.crew.filter((c) => c.status !== "registered").length;
  const row = (e) => <RegRow key={e.entry_id} entry={e} busy={busy[e.entry_id]} onEdit={() => guard() && setEditing(e)} onDelete={() => setDeleting(e)}
    onEmail={() => request([e.entry_id], true, e.entry_id)} onWhatsApp={() => whatsApp(e)} />;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-5 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-register-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Crew Registration</DialogTitle>
          <DialogDescription className="text-left text-sm">Your crew register works for all your boats. Crew register once, then you can invite them on any trip. Only you can see their details.</DialogDescription>
        </DialogHeader>
        <button type="button" className="btn-ghost h-10 gap-1.5 self-end px-3 text-sm" onClick={refresh} disabled={refreshing} data-testid="reg-refresh-btn">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
        <Section title="Crew" hint="Send a registration request, then they fill in their own details when they log in." empty="No crew yet. Add Tom, Dick and Harry here." rows={reg.crew} testId="reg-crew">
          {reg.crew.map(row)}
        </Section>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={() => add("crew")} data-testid="reg-add-crew-btn"><UserPlus className="h-4 w-4" /> Add crew member</button>
          {waiting > 0 && (
            <button type="button" className="btn-ghost h-11 justify-center gap-2" disabled={!!busy.all} onClick={() => request(null, true, "all")} data-testid="reg-send-all-btn">
              {busy.all ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email registration request to everyone not registered ({waiting})
            </button>
          )}
        </div>
        <Section title="Interested parties" hint="Family or shore contacts. They're registered straight away and can be emailed the crew's details." empty="No interested parties yet." rows={reg.parties} testId="reg-parties">
          {reg.parties.map(row)}
        </Section>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={() => add("party")} data-testid="reg-add-party-btn"><UserPlus className="h-4 w-4" /> Add interested party</button>
          {reg.parties.length > 0 && <EmailPartiesButton boatId={boatId} online={online} premium={premium} onUpgrade={onUpgrade} testId="reg-email-parties-btn" />}
        </div>
        <RegEntryDialog entry={editing} onSaved={load} onClose={() => setEditing(null)} />
        <ConfirmDelete item={deleting} title={`Remove ${deleting?.name || ""}?`} note="They're removed from your register. Crew already on a boat stay on it." testId="reg-delete" confirmLabel="Remove" onConfirm={remove} onClose={() => setDeleting(null)} />
      </DialogContent>
    </Dialog>
  );
};
