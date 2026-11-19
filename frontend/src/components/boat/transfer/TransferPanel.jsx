import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Loader2, Mail } from "lucide-react";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { api, apiError } from "@/lib/api";

const Tick = ({ id, checked, onChange, children }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-md border-[1.5px] border-[var(--line)] bg-white px-3 py-2 text-sm font-bold" data-testid={`transfer-${id}`}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`transfer-${id}-checkbox`} />
    <span>{children}</span>
  </label>
);

// Top of the "Transfer ownership" list: email the checklist, two ticks, then a double-confirmed SELL MY BOAT.
export const TransferPanel = ({ boat, vessel, items, online, pending, onExportAll, onSold }) => {
  const [request, setRequest] = useState(undefined);
  const [received, setReceived] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [ask, setAsk] = useState(0);
  useEffect(() => {
    if (!online) return;
    api.get("/ownership/status", { params: { boat_id: boat.boat_id } }).then(({ data }) => setRequest(data.request)).catch(() => setRequest(null));
  }, [online, boat.boat_id]);
  const email = async () => {
    setBusy("email");
    try {
      const { data } = await api.post("/ownership/email-checklist", { items: items.map((i) => i.label) }, { params: { boat_id: boat.boat_id } });
      toast.success(data.training ? "Model Vessel: nothing is emailed in training" : `Checklist emailed to ${data.to}`);
    } catch (e) { toast.error(apiError(e, "Couldn't email the checklist")); }
    setBusy("");
  };
  const trySell = () => {
    if (!received || !exported) { setError("Tick Transfer Ownership checklist received and Export and save all lists for your records first."); return; }
    if (pending) { setError("Wait for your latest changes to sync, then try again."); return; }
    setError("");
    setAsk(1);
  };
  const sell = async () => {
    setAsk(0);
    setBusy("sell");
    try {
      const { data } = await api.post("/ownership/sell", { checklist_received: received, exported }, { params: { boat_id: boat.boat_id }, timeout: 30000 });
      toast.success(`Transfer successful. ${vessel || "The boat"} now belongs to ${data.buyer_name || data.buyer_email}, and they've been told.`, { duration: 8000 });
      onSold();
    } catch (e) { setError(apiError(e, "Couldn't transfer the boat")); setBusy(""); }
  };
  const ready = !!request && online;
  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-[var(--cream,#FFF8EE)] p-3" data-testid="transfer-panel">
      <p className="text-sm font-bold" data-testid="transfer-request-status">
        {request === undefined ? "Checking for the new owner's request..." : request
          ? <>New owner: <span className="text-emerald-700">{request.buyer_name || request.buyer_email}</span> ({request.buyer_email}) has requested this boat.</>
          : <>Waiting for the new owner. They use the menu ☰ &gt; Request Ownership Transfer..., with the boat name <b>{vessel}</b> and your email.</>}
      </p>
      <button type="button" className="btn-solid h-11 justify-center" disabled={!online || busy === "email"} onClick={email} data-testid="transfer-email-checklist-btn">
        {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Email Transfer Ownership Checklist
      </button>
      <Tick id="received" checked={received} onChange={setReceived}>Transfer Ownership checklist received</Tick>
      <div className="flex items-stretch gap-2">
        <div className="flex-1"><Tick id="exported" checked={exported} onChange={setExported}>Export and save all lists for your records</Tick></div>
        <button type="button" className="btn-ghost shrink-0 px-3" onClick={onExportAll} data-testid="transfer-export-all-btn"><Download className="h-4 w-4" />Export All</button>
      </div>
      <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="transfer-red-info">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />The Transfer Ownership checklist is deleted on transfer. The new owner will not see it.
      </p>
      {error && <p role="alert" className="rounded-md border-[1.5px] border-[var(--red)] px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="transfer-error">{error}</p>}
      <button type="button" className="btn-solid h-12 justify-center !bg-[var(--red)]" disabled={!ready || busy === "sell"} onClick={trySell} data-testid="transfer-sell-btn">
        {busy === "sell" && <Loader2 className="h-4 w-4 animate-spin" />}Transfer ownership - SELL MY BOAT
      </button>
      <ConfirmDelete item={ask === 1 ? { name: vessel } : null} onClose={() => setAsk(0)} onConfirm={(e) => { e.preventDefault(); setAsk(2); }} testId="transfer-confirm-1"
        title={`Sell ${vessel || "this boat"} to ${request?.buyer_name || request?.buyer_email || "the new owner"}?`} confirmLabel="Yes, continue" cancelLabel="Not yet"
        note="The boat moves to the new owner's account and leaves yours." warning="Crew, trips, Route Planning, shore contacts, the watch rota, Crew Prep copies and this checklist are removed. Food & Drink cupboards are emptied and crew names in the Ship's Log are replaced with XXXXXXXXXX." />
      <ConfirmDelete item={ask === 2 ? { name: vessel } : null} onClose={() => setAsk(0)} onConfirm={sell} testId="transfer-confirm-2"
        title="Are you absolutely sure?" confirmLabel="SELL MY BOAT" cancelLabel="Cancel" note={`This can't be undone. You will no longer see ${vessel || "this boat"} in My Boat Prep.`} />
    </section>
  );
};
