import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";

// A buyer asks for a boat by its name and the current owner's email; the seller's SELL MY BOAT button then works.
export const RequestTransferDialog = ({ open, online, onClose }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);
  const load = () => api.get("/ownership/requests").then(({ data }) => setMine(data.requests)).catch(() => {});
  useEffect(() => { if (open && online) load(); }, [open, online]);
  const send = async () => {
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast.error("Enter the boat's name and the current owner's email"); return; }
    setBusy(true);
    try {
      await api.post("/ownership/requests", { boat_name: name.trim(), owner_email: email.trim() });
      toast.success(`Request sent. ${name.trim()} comes to you when the owner presses SELL MY BOAT.`);
      setName(""); setEmail(""); load();
    } catch (e) { toast.error(apiError(e, "Couldn't send the request")); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto border-2 border-[var(--navy)]" data-testid="request-transfer-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><ArrowRightLeft className="h-5 w-5" />Request Ownership Transfer</DialogTitle>
          <DialogDescription>Buying a boat that's on My Boat Prep? Ask for it here. It's held until the owner finishes their Transfer ownership steps.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1"><span className="field-label">Boat name</span>
          <input className="field-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kia Ora" data-testid="request-transfer-boat-input" />
        </label>
        <label className="flex flex-col gap-1"><span className="field-label">Current owner's email</span>
          <input className="field-input" type="email" autoCapitalize="none" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" data-testid="request-transfer-email-input" />
        </label>
        <button type="button" className="btn-solid h-11 justify-center" disabled={busy || !online} onClick={send} data-testid="request-transfer-send-btn">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{online ? "Request transfer" : "Needs a signal"}
        </button>
        {mine.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-[var(--line)] pt-2" data-testid="request-transfer-mine">
            {mine.map((r) => (
              <li key={r.request_id} className="text-sm" data-testid={`request-transfer-row-${r.request_id}`}>
                <b>{r.boat_name}</b> from {r.owner_email} · <span className={r.status === "done" ? "font-bold text-emerald-700" : "text-[var(--muted)]"}>{r.status === "done" ? "Transferred to you" : "Waiting for the owner"}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};
