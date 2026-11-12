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

const ZoneChoice = ({ zones, off, setOff, count }) => {
  const none = off.length === zones.length;
  return (
    <div className="flex flex-col gap-1.5" data-testid="print-cards-zones">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[var(--navy)]">Print QR cards for</span>
        <button type="button" className="text-sm font-bold text-[var(--navy)] underline underline-offset-2" onClick={() => setOff(none ? [] : zones.map(([k]) => k))} data-testid="print-cards-zones-all-btn">
          {none ? "Select all" : "Deselect all"}
        </button>
      </div>
      <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-md border-[1.5px] border-[var(--line)] p-1">
        {zones.map(([k, label]) => (
          <li key={k || "none"}>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-[var(--panel)]" data-testid={`print-cards-zone-${(k || "none").toLowerCase()}`}>
              <input type="checkbox" checked={!off.includes(k)} onChange={(e) => setOff((o) => (e.target.checked ? o.filter((x) => x !== k) : [...o, k]))} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`print-cards-zone-${(k || "none").toLowerCase()}-input`} />
              <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
              <span className="shrink-0 text-xs text-[var(--muted)]">{count(k)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Print Cards: QR cards for every cupboard, folder and box (scan to Magic Scan into it), or contents cards for folders and boxes.
export const FolderCardsButton = ({ areas, zones, vessel, online, boat, ownerId }) => {
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("qr");
  const [ask, setAsk] = useState(false);
  const [off, setOff] = useState([]);
  const subs = areas.filter((a) => a.parent_id && areas.some((p) => p.id === a.parent_id));
  if (!areas.length || !boat) return null;
  const parentOf = (a) => (a.parent_id ? areas.find((p) => p.id === a.parent_id) : null);
  const contents = () => subs.slice(0, 200).map((s) => ({
    name: s.name.slice(0, 120), parent: (parentOf(s)?.name || "").slice(0, 120), zone: (zones[s.id]?.map || "").slice(0, 80),
    items: (s.items || []).slice(0, 400).map((i) => ({ name: String(i.name || "").slice(0, 200), qty: Math.max(0, Math.min(99999, Number(i.qty) || 1)), removed: !!i.removed })),
  }));
  const zoneOf = (a) => zones[a.id] || zones[a.parent_id];
  const qrAreas = areas.filter((a) => !a.parent_id || parentOf(a));
  // Zones to choose from on the QR print screen, in boat order; cupboards with no zone are their own group.
  const zoneList = [...new Map(qrAreas.map((a) => { const z = zoneOf(a); return [z?.colour || "", z ? z.map : "No zone yet"]; })).entries()];
  const picked = qrAreas.filter((a) => !off.includes(zoneOf(a)?.colour || ""));
  const qrs = () => picked.slice(0, 300).map((a) => {
    const z = zoneOf(a);
    return { url: qrUrl(boat, ownerId, a.id), name: a.name.slice(0, 120), parent: (parentOf(a)?.name || "").slice(0, 120), zone: (z?.map || "").slice(0, 80), where: (a.where || parentOf(a)?.where || "").trim().slice(0, 160), hex: /^#[0-9a-f]{6}$/i.test(z?.hex || "") ? z.hex : "" };
  });
  const print = async () => {
    if (!online) { toast.error("Making the cards needs a signal"); return; }
    if (kind === "qr" && !picked.length) { toast.error("Pick at least one zone to print QR cards for"); return; }
    if (kind === "contents" && !subs.length) { toast.error("Contents cards are for folders and boxes. Add a folder or box inside a cupboard first."); return; }
    setBusy(true);
    try {
      const cards = kind === "qr" ? qrs() : contents();
      const { data } = await api.post(kind === "qr" ? "/inventory/qr-cards.pdf" : "/inventory/folder-cards.pdf", { vessel: (vessel || "").slice(0, 120), cards }, { responseType: "blob", timeout: 60000 });
      download(data, kind === "qr" ? "Cupboard QR cards.pdf" : "Folder and box contents cards.pdf");
      toast.success(kind === "qr" ? `${cards.length} QR ${cards.length === 1 ? "card" : "cards"} ready to print and laminate` : `${cards.length} contents ${cards.length === 1 ? "card" : "cards"} ready to print`);
    } catch { toast.error("Couldn't make the cards. Please try again."); }
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="inventory-print-cards">
      <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={() => { setOff([]); setAsk(true); }} disabled={busy} data-testid="inventory-folder-cards-btn">
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
        note={kind === "qr" ? `Making a QR card for each of the ${Math.min(picked.length, 300)} cupboards, folders and boxes in the zones you pick can take a while.` : `Making contents cards for your ${Math.min(subs.length, 200)} folders and boxes can take a while.`}
        body={kind === "qr" && zoneList.length > 1 ? <ZoneChoice zones={zoneList} off={off} setOff={setOff} count={(k) => qrAreas.filter((a) => (zoneOf(a)?.colour || "") === k).length} /> : null}
        onConfirm={(e) => { if (kind === "qr" && !picked.length) { e.preventDefault(); toast.error("Pick at least one zone to print QR cards for"); return; } setAsk(false); print(); }} onClose={() => setAsk(false)} />
    </div>
  );
};
