import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Crown, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const usePaymentStatus = (sessionId) => {
  const [state, setState] = useState(sessionId ? "checking" : "error");
  const { refresh } = useAuth();
  const started = useRef(false);
  useEffect(() => {
    if (!sessionId || started.current) return;
    started.current = true;
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") { await refresh(); setState("paid"); return; }
        if (["expired", "failed"].includes(data.payment_status)) { setState("error"); return; }
      } catch { /* retry */ }
      if (tries < 15) setTimeout(poll, 2000); else setState("timeout");
    };
    poll();
  }, [sessionId, refresh]);
  return state;
};

const MESSAGES = {
  checking: { Icon: Loader2, title: "Confirming your payment...", text: "This only takes a few seconds." },
  paid: { Icon: CheckCircle2, title: "Welcome to Pro!", text: "Ads are gone and every feature is unlocked. Your plan renews yearly for NZD 9.99." },
  timeout: { Icon: Loader2, title: "Still confirming", text: "Your payment is taking longer than usual. Pro switches on by itself once Stripe confirms it." },
  error: { Icon: XCircle, title: "Payment not completed", text: "No money was taken. You can try again from the account menu." },
  cancel: { Icon: XCircle, title: "Checkout cancelled", text: "No problem, nothing was charged. You're still on the Free plan." },
};

export default function PaymentResult({ success }) {
  const [params] = useSearchParams();
  const status = usePaymentStatus(success ? params.get("session_id") : null);
  const key = success ? status : "cancel";
  const { Icon, title, text } = MESSAGES[key];
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6" data-testid="payment-result-page">
      <Icon className={`h-14 w-14 ${key === "paid" ? "text-[var(--green)]" : key === "checking" || key === "timeout" ? "animate-spin text-[var(--navy)]" : "text-[var(--red)]"}`} />
      <h1 className="font-display text-3xl font-extrabold tracking-tight" data-testid="payment-result-title">{title}</h1>
      <p className="text-[var(--muted)]" data-testid="payment-result-text">{text}</p>
      <Link to="/" className="btn-solid self-start px-6" data-testid="payment-back-btn"><Crown className="h-4 w-4" /> Back to My Boat Prep</Link>
    </main>
  );
}
