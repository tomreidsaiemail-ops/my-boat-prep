import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Settings, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import useAdminLists from "@/hooks/useAdminLists";

const WARNING = "Admin - Help Panel - Ignore 300 metre warning";

// The warning text comes from the admin Help Panel list, so it can be edited without a new release.
export const Ignore300Warning = ({ online }) => {
  const panels = useAdminLists("Admin - Help Panel - ", online);
  const items = panels.find((p) => p.name.trim().toLowerCase() === WARNING.toLowerCase())?.items || [];
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950" role="alert" data-testid="ignore-300-warning">
      <p className="flex items-center gap-1.5 font-extrabold"><ShieldAlert className="h-4 w-4 shrink-0" /> Warning</p>
      {items.map((i, k) => (
        <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""} data-testid={`ignore-300-warning-line-${k}`}>{i.label}</p>
      ))}
    </div>
  );
};

export const MySettingsDialog = ({ open, onClose }) => {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const online = navigator.onLine;
  const toggle = async (on) => {
    setBusy(true);
    try {
      const { data } = await api.put("/me/privacy", { ignore_300: on });
      setUser(data);
      toast.success(on ? "Broadcasting to your shore contact on or near land too" : "Positions on or near land are kept private again");
    } catch (e) { toast.error(apiError(e, "Couldn't save that setting, please try again")); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)] bg-white" data-testid="my-settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-black text-[var(--navy)]"><Settings className="h-5 w-5" /> My settings</DialogTitle>
          <DialogDescription className="text-sm text-slate-700">Settings for you, on every boat.</DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-3" data-testid="privacy-settings">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">Privacy Settings</h3>
          <label className="flex items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm" data-testid="ignore-300-label">
            <input type="checkbox" checked={!!user?.ignore_300} disabled={busy || !online} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="ignore-300-checkbox" />
            <span><b>Ignore 300 metre from land shore contact broadcast.</b> I want to broadcast to my shore contact and am aware of this privacy setting.</span>
            {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
          </label>
          {!online && <p className="text-xs text-[var(--muted)]">Go online to change this setting.</p>}
          <Ignore300Warning online={online} />
        </section>
      </DialogContent>
    </Dialog>
  );
};
