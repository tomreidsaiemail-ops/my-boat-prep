import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const Input = ({ id, label, ...props }) => (
  <label htmlFor={id} className="flex flex-col gap-1">
    <span className="field-label">{label}</span>
    <input id={id} className="field-input" data-testid={`${id}-input`} {...props} />
  </label>
);

export const PasswordField = ({ id = "password", label = "Password", value, onChange, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="field-label">{label}</span>
      <span className="relative">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} required minLength={8}
          autoComplete={autoComplete} className="field-input w-full !pr-12" data-testid={`${id}-input`} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} data-testid={`${id}-toggle-btn`}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[var(--muted)] hover:text-[var(--navy)]">
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
    </label>
  );
};

export const PasswordForm = () => {
  const { setUser } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";
  const [verify, setVerify] = useState("");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(register ? "/auth/register" : "/auth/login", register ? form : { email: form.email, password: form.password });
      if (data.verify) setVerify(data.email);
      else setUser(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (verify) return <EmailCodeForm email={verify} onBack={() => setVerify("")} />;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-4" data-testid="password-form">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-[var(--bg)] p-1" role="tablist">
        {[["signin", "Sign in"], ["register", "Create account"]].map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(""); }} data-testid={`auth-tab-${m}`}
            className={`min-h-[40px] rounded font-bold text-sm [transition:background-color_.15s] ${mode === m ? "bg-[var(--navy)] text-white" : "text-[var(--muted)]"}`}>{label}</button>
        ))}
      </div>
      {register && <Input id="name" label="Your name" value={form.name} onChange={(e) => set("name")(e.target.value)} autoComplete="name" maxLength={80} />}
      <Input id="email" label="Email" type="email" required value={form.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" />
      <PasswordField value={form.password} onChange={set("password")} autoComplete={register ? "new-password" : "current-password"} />
      {register && <p className="-mt-1 text-xs text-[var(--muted)]">At least 8 characters.</p>}
      {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="auth-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn-solid min-h-[52px] disabled:opacity-60" data-testid="password-submit-btn">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{register ? "Create account" : "Sign in"}
      </button>
      {!register && <Link to="/forgot-password" className="self-center text-sm font-bold text-[var(--blue)] hover:underline" data-testid="forgot-password-link">Forgot password?</Link>}
    </form>
  );
};

// 2FA, once: the 6-digit code emailed when the account is made.
const EmailCodeForm = ({ email, onBack }) => {
  const { setUser } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState("");
  const check = async (e) => {
    e.preventDefault();
    setBusy("check");
    setError("");
    setInfo("");
    try { const { data } = await api.post("/auth/verify-email", { email, code }); setUser(data); }
    catch (err) { setError(apiError(err)); } finally { setBusy(""); }
  };
  const resend = async () => {
    setBusy("resend");
    setError("");
    try { await api.post("/auth/resend-code", { email }); setInfo("A new code is on its way (it can take a minute)."); }
    catch (err) { setError(apiError(err)); } finally { setBusy(""); }
  };
  return (
    <form onSubmit={check} className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-4" data-testid="email-code-form">
      <h2 className="font-display text-lg font-extrabold">Check your email</h2>
      <p className="text-sm text-[var(--muted)]">We sent a 6-digit code to <b className="text-[var(--navy)]" data-testid="email-code-address">{email}</b>. Type it here to confirm it&apos;s you. You only do this once.</p>
      <Input id="email-code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="field-input text-center text-2xl font-bold tracking-[0.4em]" />
      {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="email-code-message">{error}</p>}
      {info && !error && <p className="text-sm font-bold text-[var(--navy)]" role="status" data-testid="email-code-info">{info}</p>}
      <button type="submit" disabled={!!busy || code.length !== 6} className="btn-solid min-h-[52px] disabled:opacity-60" data-testid="email-code-submit-btn">
        {busy === "check" && <Loader2 className="h-4 w-4 animate-spin" />}Confirm and continue
      </button>
      <div className="flex justify-between text-sm font-bold">
        <button type="button" onClick={onBack} className="text-[var(--muted)] hover:underline" data-testid="email-code-back-btn">Back</button>
        <button type="button" onClick={resend} disabled={!!busy} className="text-[var(--blue)] hover:underline" data-testid="email-code-resend-btn">Send a new code</button>
      </div>
    </form>
  );
};
