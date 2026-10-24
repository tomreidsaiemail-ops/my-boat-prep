import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TERMS_VERSION } from "@/lib/terms";
import { TermsContent } from "@/components/legal/TermsContent";

const localKey = (userId) => `mbp_tos_${userId}`;

// Acceptance is kept on the phone first, so skippers offline at sea are never locked out; it syncs when online.
export const TermsGate = ({ children }) => {
  const { user, setUser } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [local, setLocal] = useState(() => localStorage.getItem(localKey(user.user_id)) === TERMS_VERSION);
  const onServer = user.tos_version === TERMS_VERSION;

  useEffect(() => {
    if (!local || onServer || !navigator.onLine) return;
    api.post("/auth/accept-terms", { version: TERMS_VERSION }).then(({ data }) => setUser(data)).catch(() => {});
  }, [local, onServer, setUser]);

  if (local || onServer) return children;

  const accept = () => {
    localStorage.setItem(localKey(user.user_id), TERMS_VERSION);
    setLocal(true);
    toast.success("Thanks, Skipper. Terms accepted");
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-40 pt-6" data-testid="terms-gate">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-8 w-8 shrink-0 text-[var(--red)]" />
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Before you set sail</h1>
      </div>
      <p className="text-base text-[var(--muted)]">Please read and accept the My Boat Prep Terms of Service to keep using the app.</p>
      <TermsContent />
      {/* Blank space so the last terms scroll clear of the fixed accept panel. */}
      <div aria-hidden="true" className="h-48 shrink-0" data-testid="terms-gate-spacer" />
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-[var(--navy)] bg-white/95 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold" data-testid="terms-agree-label">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--navy)]" data-testid="terms-agree-checkbox" />
            I have read and agree to the Terms of Service, and I understand this app does not replace safety equipment or training.
          </label>
          <button type="button" className="btn-solid h-12 disabled:opacity-50" disabled={!agreed} onClick={accept} data-testid="terms-accept-btn">Accept and continue</button>
        </div>
      </div>
    </main>
  );
};
