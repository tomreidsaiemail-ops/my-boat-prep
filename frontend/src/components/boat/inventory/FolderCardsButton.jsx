import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { api } from "@/lib/api";

// One quarter-page contents card per folder or box, to print and slip inside it.
export const FolderCardsButton = ({ areas, zones, vessel, online }) => {
  const [busy, setBusy] = useState(false);
  const subs = areas.filter((a) => a.parent_id && areas.some((p) => p.id === a.parent_id));
  if (!subs.length) return null;
  const print = async () => {
    if (!online) { toast.error("Making the cards needs a signal"); return; }
    setBusy(true);
    try {
      const cards = subs.map((s) => ({
        name: s.name.slice(0, 120), parent: (areas.find((p) => p.id === s.parent_id)?.name || "").slice(0, 120), zone: (zones[s.id]?.map || "").slice(0, 80),
        items: (s.items || []).slice(0, 400).map((i) => ({ name: String(i.name || "").slice(0, 200), qty: Math.max(0, Math.min(99999, Number(i.qty) || 1)), removed: !!i.removed })),
      }));
      const { data } = await api.post("/inventory/folder-cards.pdf", { vessel: (vessel || "").slice(0, 120), cards }, { responseType: "blob", timeout: 60000 });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Folder and box contents cards.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success(`${cards.length} contents ${cards.length === 1 ? "card" : "cards"} ready to print`);
    } catch { toast.error("Couldn't make the contents cards. Please try again."); }
    setBusy(false);
  };
  return (
    <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={print} disabled={busy} data-testid="inventory-folder-cards-btn">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print contents cards for {subs.length} {subs.length === 1 ? "folder or box" : "folders and boxes"}
    </button>
  );
};
