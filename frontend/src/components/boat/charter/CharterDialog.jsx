import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Anchor, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { api, apiError } from "@/lib/api";
import { STATUS, fmtDay, fmtPeriod, isOverdue } from "@/lib/charter";
import { EndCharter } from "@/components/boat/charter/EndCharter";
import { localWhen } from "@/lib/timeAgo";

const blank = { name: "", email: "", start: "", end: "" };

const CharterRow = ({ c, busy, vessel, online, onHandOver, onRemove, onEnded }) => {
  const st = STATUS[c.status] || STATUS.registered;
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid={`charter-row-${c.charter_id}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold" data-testid={`charter-row-name-${c.charter_id}`}>{c.name} <span className="font-normal text-[var(--muted)]">{c.email}</span></div>
          <div className="text-sm" data-testid={`charter-row-period-${c.charter_id}`}>{fmtPeriod(c)}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${st.cls}`} data-testid={`charter-row-status-${c.charter_id}`}>{st.text}</span>
      </div>
      <div className="flex flex-col text-xs text-[var(--muted)]">
        {c.handed_at && <span>Handed over {localWhen(c.handed_at)}</span>}
        {c.status === "handed_over" && <span data-testid={`charter-row-claimed-${c.charter_id}`}>{c.claimed_at ? `Charter skipper has the boat since ${localWhen(c.claimed_at)}` : "Waiting for the charter skipper to log in with that email"}</span>}
        {c.terms_accepted_at && <span data-testid={`charter-row-terms-${c.charter_id}`}>Charter Boat Terms and Conditions accepted {localWhen(c.terms_accepted_at)}</span>}
        {c.status === "handed_over" && isOverdue(c) && <span className="font-bold text-amber-900" data-testid={`charter-row-overdue-${c.charter_id}`}>The charter ended {fmtDay(c.end)}. End it to unlock {vessel} and bring back the logs.</span>}
        {c.returned_at && <span data-testid={`charter-row-returned-${c.charter_id}`}>Charter ended {localWhen(c.returned_at)}{c.status === "returned" && c.delete_at ? `. Charter copy read only until ${localWhen(c.delete_at)}, then deleted` : ""}</span>}
        {c.deleted_at && <span data-testid={`charter-row-deleted-${c.charter_id}`}>Charter copy deleted {localWhen(c.deleted_at)}</span>}
      </div>
      {c.status === "handed_over" && <div className="flex"><EndCharter c={c} vessel={vessel} online={online} onEnded={onEnded} /></div>}
      {c.status === "registered" && (
        <div className="flex gap-2">
          <button type="button" className="btn-solid h-10 flex-1 justify-center gap-2" disabled={busy} onClick={() => onHandOver(c)} data-testid={`charter-handover-btn-${c.charter_id}`}><Anchor className="h-4 w-4" /> Hand over the boat</button>
          <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label={`Remove ${c.name}'s charter`} onClick={() => onRemove(c)} data-testid={`charter-remove-btn-${c.charter_id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
        </div>
      )}
    </li>
  );
};

// Charter Registrations: register a charter skipper for a period, then hand over a clean copy of the boat.
export const CharterDialog = ({ open, boat, vessel, online, onClose, onHandedOver }) => {
  const [rows, setRows] = useState([]);
  const [lists, setLists] = useState([]);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [handing, setHanding] = useState(null);
  const [removing, setRemoving] = useState(null);
  const load = () => api.get("/charters", { params: { boat_id: boat.boat_id } }).then(({ data }) => { setRows(data.charters); setLists(data.handover_lists); }).catch(() => {});
  useEffect(() => { if (open && online) { load(); setForm(blank); setError(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(""); };
  const register = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.start || !form.end) { setError("Fill in the charter skipper's name, email and both dates"); return; }
    setBusy("add");
    try { await api.post("/charters", { boat_id: boat.boat_id, ...form }); setForm(blank); toast.success(`${form.name.trim()} registered for a charter`); load(); }
    catch (err) { setError(apiError(err, "Couldn't register that charter")); }
    finally { setBusy(""); }
  };
  const handOver = async () => {
    const c = handing;
    setHanding(null); setBusy("hand");
    try { await api.post(`/charters/${c.charter_id}/handover`); toast.success(`${vessel} handed over to ${c.name}. Your boat is read only until the charter ends.`); load(); onHandedOver?.(); }
    catch (err) { toast.error(apiError(err, "Couldn't hand the boat over")); }
    finally { setBusy(""); }
  };
  const remove = async () => {
    const c = removing;
    setRemoving(null);
    try { await api.delete(`/charters/${c.charter_id}`); load(); } catch (err) { toast.error(apiError(err, "Couldn't remove that charter")); }
  };
  const charterLists = lists.filter((n) => n.toLowerCase().startsWith("charter - "));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="charter-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase">Charter Registrations</DialogTitle>
          <DialogDescription>Register a charter skipper for a period, then hand {vessel} over. They get a clean copy of the boat; yours stays untouched and read only until the charter ends.</DialogDescription>
        </DialogHeader>
        <form onSubmit={register} className="flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-[var(--line)] p-3" data-testid="charter-form">
          <input value={form.name} onChange={set("name")} maxLength={80} placeholder="Charter skipper's name" className="field-input" data-testid="charter-name-input" />
          <input value={form.email} onChange={set("email")} type="email" maxLength={120} placeholder="Their email (they log in with it)" className="field-input" data-testid="charter-email-input" />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1"><span className="field-label">First day</span><input type="date" value={form.start} onChange={set("start")} className="field-input" data-testid="charter-start-input" /></label>
            <label className="flex flex-col gap-1"><span className="field-label">Last day</span><input type="date" value={form.end} min={form.start || undefined} onChange={set("end")} className="field-input" data-testid="charter-end-input" /></label>
          </div>
          {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid="charter-form-error">{error}</p>}
          <button type="submit" className="btn-solid h-11 justify-center gap-2" disabled={busy === "add" || !online} data-testid="charter-register-btn">
            {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Register charter
          </button>
        </form>
        {rows.length ? <ul className="flex flex-col gap-2" data-testid="charter-list">{rows.map((c) => <CharterRow key={c.charter_id} c={c} busy={!!busy || !online} vessel={vessel} online={online} onHandOver={setHanding} onRemove={setRemoving} onEnded={() => { load(); onHandedOver?.(); }} />)}</ul>
          : <p className="text-sm text-[var(--muted)]" data-testid="charter-empty">No charters yet.</p>}
        <ConfirmDelete item={handing ? {} : null} danger={false} testId="charter-handover" title={`Hand ${vessel} over to ${handing?.name || ""}?`} confirmLabel="Hand over" cancelLabel="Not yet"
          note={`${handing ? fmtPeriod(handing) : ""}. They get a copy with these lists: ${lists.join(", ") || "none"}. ${charterLists.length ? `Your Charter lists (${charterLists.join(", ")}) are copied too.` : "Tip: lists you name \"Charter - ...\", e.g. \"Charter - charter skipper responsibilities\", are copied too."} Cupboards, Ship's Log and My To Do List come across empty, with no routes, crew or invites. ${vessel} and its crew become read only until you end the charter.`}
          onConfirm={handOver} onClose={() => setHanding(null)} />
        <ConfirmDelete item={removing ? { name: `${removing.name}'s charter` } : null} testId="charter-remove" onConfirm={remove} onClose={() => setRemoving(null)} />
      </DialogContent>
    </Dialog>
  );
};
