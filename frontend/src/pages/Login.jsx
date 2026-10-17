import { Link, Navigate } from "react-router-dom";
import { Anchor, WifiOff } from "lucide-react";
import { BrandMark } from "@/components/boat/Header";
import { useAuth } from "@/context/AuthContext";
import { OAUTH_STATE_KEY } from "@/components/auth/GoogleCallback";
import { PasswordForm } from "@/components/auth/PasswordForm";

const signIn = () => {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUri = window.location.origin + "/auth/google";
  const q = new URLSearchParams({
    client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code",
    scope: "openid email profile", state, prompt: "select_account",
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
};

const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export default function Login() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  const online = navigator.onLine;
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-between gap-8 px-6 pb-10 pt-12" data-testid="login-page">
      <section className="mbp-pop flex flex-col gap-5">
        <div className="scale-[1.6] self-start origin-left"><BrandMark /></div>
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">My Boat Prep</h1>
        <p className="max-w-sm text-base text-[var(--muted)]">
          Checklists, Ship&apos;s Log and Mayday scripts for skippers. Works at sea with no signal.
        </p>
        <PasswordForm />
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]" />or<span className="h-px flex-1 bg-[var(--line)]" /></div>
        <button type="button" onClick={signIn} disabled={!online} data-testid="google-signin-btn"
          className="flex min-h-[56px] items-center justify-center gap-3 rounded-lg border-2 border-[var(--navy)] bg-white px-5 text-base font-bold text-[var(--navy)] [transition:background-color_.15s,transform_.1s] hover:bg-slate-50 active:scale-[.98] disabled:opacity-50">
          <GoogleG /> Sign in with Google
        </button>
        {!online && (
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--red)]" data-testid="login-offline-note">
            <WifiOff className="h-4 w-4" /> You need signal to sign in the first time.
          </p>
        )}
        <p className="text-xs text-[var(--muted)]" data-testid="login-terms-note">By signing in you agree to the <Link to="/terms" className="font-bold text-[var(--blue)] underline" data-testid="login-terms-link">Terms of Service</Link>.</p>
      </section>
      <p className="flex items-center gap-2 text-xs text-[var(--muted)]"><Anchor className="h-3.5 w-3.5" /> Free plan includes ads. Go Pro for NZD 4.99 a year.</p>
    </main>
  );
}
