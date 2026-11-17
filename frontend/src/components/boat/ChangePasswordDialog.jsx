import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordField } from "@/components/auth/PasswordForm";
import { api, apiError } from "@/lib/api";

// Change my password (email accounts only): current password is checked first, then the new one typed twice, no pasting.
export const ChangePasswordDialog = ({ open, onClose, onDone }) => {
  const [current, setCurrent] = useState("");
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setCurrent(""); setChecked(false); setPassword(""); setAgain(""); setError(""); } }, [open]);
  const run = async (e, call) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try { await call(); } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };
  const check = (e) => run(e, async () => { await api.post("/auth/check-password", { current }); setChecked(true); });
  const save = (e) => run(e, async () => {
    await api.post("/auth/change-password", { current, password });
    toast.success("Password changed. Other phones and browsers are signed out.");
    onDone?.();
    onClose();
  });
  const mismatch = again.length > 0 && again !== password;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="change-password-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Change password</DialogTitle>
          <DialogDescription data-testid="change-password-step-note">{checked ? "Type your new password twice. At least 8 characters. Other phones and browsers will need to sign in again." : "First, type your current password."}</DialogDescription>
        </DialogHeader>
        {!checked ? (
          <form onSubmit={check} className="flex flex-col gap-3" data-testid="change-password-current-step">
            <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" minLength={1} />
            {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="change-password-error">{error}</p>}
            <button type="submit" disabled={busy || !current} className="btn-solid min-h-[48px] justify-center disabled:opacity-60" data-testid="change-password-check-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Next
            </button>
          </form>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-3" data-testid="change-password-new-step">
            <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" noPaste />
            <PasswordField id="confirm-password" label="Re-enter new password" value={again} onChange={setAgain} autoComplete="new-password" noPaste />
            {mismatch && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="change-password-mismatch">The two new passwords don&apos;t match</p>}
            {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="change-password-error">{error}</p>}
            <button type="submit" disabled={busy || password.length < 8 || again !== password} className="btn-solid min-h-[48px] justify-center disabled:opacity-60" data-testid="change-password-save-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Change password
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
