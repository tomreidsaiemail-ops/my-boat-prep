import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PasswordField } from "@/components/auth/PasswordForm";

const Shell = ({ title, children, testId }) => (
  <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-6 pb-10 pt-12" data-testid={testId}>
    <Link to="/login" className="inline-flex items-center gap-1 self-start text-sm font-bold text-[var(--blue)]" data-testid="back-to-login-link">
      <ArrowLeft className="h-4 w-4" /> Back to sign in
    </Link>
    <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
    {children}
  </main>
);

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/auth/forgot-password", { email }); setSent(true); } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Forgot password" testId="forgot-password-page">
      {sent ? (
        <p className="flex items-start gap-2 rounded-lg border-[1.5px] border-green-300 bg-green-50 p-4 text-sm font-semibold text-green-900" data-testid="forgot-sent">
          <MailCheck className="h-5 w-5 shrink-0" /> If {email} has an account, we've emailed a link to set a new password. It expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">Enter your email and we'll send a link to choose a new password. This also works for Google accounts that want a password too.</p>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" className="field-input" data-testid="forgot-email-input" />
          <button type="submit" disabled={busy} className="btn-solid min-h-[52px]" data-testid="forgot-submit-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Send reset link</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token: params.get("token") || "", password });
      toast.success("Password saved. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Choose a new password" testId="reset-password-page">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <PasswordField id="new-password" label="New password (at least 8 characters)" value={password} onChange={setPassword} autoComplete="new-password" />
        <button type="submit" disabled={busy} className="btn-solid min-h-[52px]" data-testid="reset-submit-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save new password</button>
      </form>
    </Shell>
  );
}
