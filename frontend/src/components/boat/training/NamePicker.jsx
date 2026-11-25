import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { pickName } from "@/lib/highlight";

// Admin "?" in the training window: tap a button or box on screen to get its name, then add "!!-!!Highlight <name>" to this step.
export const NamePicker = ({ onAdd, onClose, t }) => {
  const [name, setName] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => (name === null ? pickName((n) => setName(n)) : undefined), [name]);
  const add = async () => { setBusy(true); if (await onAdd(name)) onClose(); setBusy(false); };
  const shell = "flex flex-wrap items-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-950";
  if (name === null) {
    return (
      <div className={shell} data-testid={`${t}-name-pick-waiting`}>
        <span className="flex-1">Tap any button or box on the screen to get its name.</span>
        <button type="button" onClick={onClose} className="btn-ghost h-9 min-h-0 gap-1 px-2.5 text-xs" data-testid={`${t}-name-pick-cancel-btn`}><X className="h-3.5 w-3.5" /> Cancel</button>
      </div>
    );
  }
  return (
    <div className={shell} data-testid={`${t}-name-pick-result`}>
      <span className="min-w-0 flex-1" data-testid={`${t}-name-pick-name`}>{name ? <>That&apos;s &ldquo;{name}&rdquo;: <code className="font-mono text-xs">!!-!!Highlight {name}</code></> : "That has no name I can find. Try its label, or the button beside it."}</span>
      {name && <button type="button" onClick={add} disabled={busy} className="btn-solid h-9 min-h-0 gap-1 !bg-emerald-700 px-2.5 text-xs" data-testid={`${t}-name-pick-add-btn`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add to this step</button>}
      <button type="button" onClick={() => setName(null)} className="btn-ghost h-9 min-h-0 px-2.5 text-xs" data-testid={`${t}-name-pick-again-btn`}>Tap another</button>
      <button type="button" onClick={onClose} className="btn-ghost h-9 min-h-0 gap-1 px-2.5 text-xs" data-testid={`${t}-name-pick-close-btn`}><X className="h-3.5 w-3.5" /> Cancel</button>
    </div>
  );
};
