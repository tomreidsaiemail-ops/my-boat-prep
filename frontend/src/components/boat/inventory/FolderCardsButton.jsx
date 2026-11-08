import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { qrUrl } from "@/lib/qrScan";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

// Print Cards: QR cards for every cupboard, folder and box (scan to Magic Scan into it), or contents cards for folders and boxes.
export const FolderCardsButton = ({ areas, zones, vessel, online, boat, ownerId }) => {
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("qr");
  const [ask, setAsk] = useState(false);
  const subs = areas.filter((a) => a.parent_id && areas.some((p) => p.id === a.parent_id));
  if (!areas.length || !boat) return null;
  const parentOf = (a) => (a.parent_id ? areas.find((p) => p.id === a.parent_id) : null);
  const contents = () => subs.slice(0, 200).map((s) => ({
    name: s.name.slice(0, 120), parent: (parentOf(s)?.name || "").slice(0, 120), zone: (zones[s.id]?.map || "").slice(0, 80),
    items: (s.items || []).slice(0, 400).map((i) => ({ name: String(i.name || "").slice(0, 200), qty: Math.max(0, Math.min(99999, Number(i.qty) || 1)), removed: !!i.removed })),
  }));
  const qrs = () => areas.filter((a) => !a.parent_id || parentOf(a)).slice(0, 300).map((a) => {
    const z = zones[a.id] || zones[a.parent_id];
    return { url: qrUrl(boat, ownerId, a.id), name: a.name.slice(0, 120), parent: (parentOf(a)?.name || "").slice(0, 120), zone: (z?.map || "").slice(0, 80), hex: /^#[0-9a-f]{6}$/i.test(z?.hex || "") ? z.hex : "" };
  });
  const print = async () => {
    if (!online) { toast.error("Making the cards needs a signal"); return; }
    if (kind === "contents" && !subs.length) { toast.error("Contents cards are for folders and boxes. Add a folder or box inside a cupboard first."); return; }
    setBusy(true);
    try {
      const cards = kind === "qr" ? qrs() : contents();
      const { data } = await api.post(kind === "qr" ? "/inventory/qr-cards.pdf" : "/inventory/folder-cards.pdf", { vessel: (vessel || "").slice(0, 120), cards }, { responseType: "blob", timeout: 60000 });
      download(data, kind === "qr" ? "Boat area QR cards.pdf" : "Folder and box contents cards.pdf");
      toast.success(kind === "qr" ? `${cards.length} QR ${cards.length === 1 ? "card" : "cards"} ready to print and laminate` : `${cards.length} contents ${cards.length === 1 ? "card" : "cards"} ready to print`);
    } catch { toast.error("Couldn't make the cards. Please try again."); }
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="inventory-print-cards">
      <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={() => setAsk(true)} disabled={busy} data-testid="inventory-folder-cards-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print Cards
      </button>
      <div className="flex items-center gap-3" role="radiogroup" aria-label="Card type" data-testid="inventory-print-cards-kind">
        {[["qr", "QR Codes"], ["contents", "Contents"]].map(([v, label]) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-bold" title={v === "contents" ? "Contents cards for the folders and boxes inside your cupboards" : "A QR card for every cupboard, folder and box. Scan it to Magic Scan things into it."} data-testid={`inventory-print-cards-${v}`}>
            <input type="radio" name="print-cards-kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="h-4 w-4 accent-[var(--navy)]" data-testid={`inventory-print-cards-${v}-radio`} /> {label}
          </label>
        ))}
      </div>
      <ConfirmDelete item={ask ? {} : null} danger={false} testId="print-cards-confirm" title="This is a lengthy process, do you want to continue?" confirmLabel="Continue" cancelLabel="Not now"
        note={kind === "qr" ? `Making a QR card for each of your ${Math.min(qrs().length, 300)} cupboards, folders and boxes can take a while.` : `Making contents cards for your ${Math.min(subs.length, 200)} folders and boxes can take a while.`}
        onConfirm={() => { setAsk(false); print(); }} onClose={() => setAsk(false)} />
    </div>
  );
};
