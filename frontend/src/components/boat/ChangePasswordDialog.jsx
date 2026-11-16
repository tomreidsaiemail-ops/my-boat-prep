import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordField } from "@/components/auth/PasswordForm";
import { api, apiError } from "@/lib/api";

// Change my password: current one first (Google-only accounts just set one). Other phones are signed out.
export const ChangePasswordDialog = ({ open, hasPassword, onClose, onDone }) => {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setCurrent(""); setPassword(""); setError(""); } }, [open]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/change-password", { current, password });
      toast.success(hasPassword ? "Password changed. Other phones and browsers are signed out." : "Password set. You can now sign in with your email and password too.");
      onDone?.();
      onClose();
    } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="change-password-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{hasPassword ? "Change password" : "Set a password"}</DialogTitle>
          <DialogDescription>At least 8 characters.{hasPassword ? " Other phones and browsers signed in to your account will need to sign in again." : ""}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-3">
          {hasPassword && <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />}
          <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
          {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="change-password-error">{error}</p>}
          <button type="submit" disabled={busy || password.length < 8 || (hasPassword && !current)} className="btn-solid min-h-[48px] justify-center disabled:opacity-60" data-testid="change-password-save-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{hasPassword ? "Change password" : "Set password"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
