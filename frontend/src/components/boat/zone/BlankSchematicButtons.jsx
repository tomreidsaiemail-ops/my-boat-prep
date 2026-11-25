import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";

const BLANKS = [
  { key: "monohull", label: "Monohull", src: "/blank-hull.png" },
  { key: "catamaran", label: "Catamaran", src: "/blank-catamaran.png" },
  { key: "trimaran", label: "Trimaran", src: "/blank-trimaran.png" },
];
// The blank schematic matching the boat type: 2 hulls for a catamaran, 3 for a trimaran, else a monohull.
export const blankFor = (type) => (/trimaran/i.test(type || "") ? BLANKS[2].src : /catamaran/i.test(type || "") ? BLANKS[1].src : BLANKS[0].src);

// Adds a blank monohull, catamaran or trimaran schematic as a new Zone Map Overview.
export const BlankSchematicButtons = ({ boatId, online, disabled = false, onDone }) => {
  const [busy, setBusy] = useState(null);
  const add = async (b) => {
    if (!online) { toast.error("Adding a blank schematic needs a signal"); return; }
    setBusy(b.key);
    try {
      const form = new FormData();
      form.append("file", await (await fetch(b.src)).blob(), "blank-schematic.png");
      form.append("kind", "overview");
      const maps = (await api.post(`/boats/${boatId}/zone-maps`, form, { timeout: 60000 })).data.zone_maps;
      toast.success(`Blank ${b.label.toLowerCase()} schematic added. Drag your colours onto it.`);
      onDone(maps);
    } catch (e) { toast.error(apiError(e, "Couldn't add the blank schematic")); }
    setBusy(null);
  };
  return (
    <div className="flex flex-col gap-1.5" data-testid="zone-blank-schematics">
      <p className="text-xs font-bold text-[var(--muted)]">Or create a blank schematic:</p>
      <div className="grid grid-cols-3 gap-2">
        {BLANKS.map((b) => (
          <button key={b.key} type="button" disabled={disabled || !!busy} onClick={() => add(b)}
            className="flex flex-col items-center gap-1 rounded-md border-[1.5px] border-[var(--line)] bg-white p-1.5 text-[12px] font-bold text-[var(--navy)] [transition:border-color_.15s,transform_.15s] hover:border-[var(--navy)] active:scale-[.98] disabled:opacity-60"
            data-testid={`zone-blank-${b.key}-btn`}>
            <span className="flex h-10 w-full items-center justify-center">
              {busy === b.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <img src={b.src} alt="" className="max-h-full max-w-full object-contain" />}
            </span>
            Blank {b.label}
          </button>
        ))}
      </div>
    </div>
  );
};
