import { useState } from "react";
import { Check, Loader2, Tag, X } from "lucide-react";
import { api, apiError } from "@/lib/api";

export const discounted = (base, pct) => Math.max(0, Math.round(base * (100 - pct)) / 100);

// Promo code box on the upgrade screen; the code is checked against our coupon list before checkout.
export const PromoCodeField = ({ base, applied, onApplied, disabled }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const apply = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) { setMsg({ error: true, text: "Type a promo code first" }); return; }
    setBusy(true); setMsg(null);
    try {
      const { data } = await api.post("/payments/promo/check", { code: c });
      if (data.automatic) setMsg({ text: data.message });
      else { onApplied(data); setCode(""); }
    } catch (err) {
      setMsg({ error: true, text: apiError(err, "Couldn't check that code. Check your signal and try again.") });
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" data-testid="plan-promo-applied">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green)]" strokeWidth={3} />
        <span className="flex-1"><b>{applied.code}</b>: {applied.percent_off}% off your first year. You pay <b data-testid="plan-promo-total">NZD {discounted(base, applied.percent_off).toFixed(2)}</b> instead of NZD {base.toFixed(2)}.</span>
        <button type="button" className="icon-btn h-7 w-7" aria-label="Remove promo code" onClick={() => { onApplied(null); setMsg(null); }} data-testid="plan-promo-remove-btn"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <form onSubmit={apply} className="flex flex-col gap-1" data-testid="plan-promo-form">
      <label htmlFor="plan-promo-input" className="field-label flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Promo code</label>
      <div className="flex gap-2">
        <input id="plan-promo-input" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/\s/g, "")); setMsg(null); }} maxLength={40}
          placeholder="Enter your code" autoCapitalize="characters" autoComplete="off" className="field-input min-w-0 flex-1 font-mono uppercase" data-testid="plan-promo-input" />
        <button type="submit" className="btn-ghost h-12 shrink-0 px-4" disabled={busy || disabled} data-testid="plan-promo-apply-btn">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Apply
        </button>
      </div>
      {msg && <p className={`text-xs font-semibold ${msg.error ? "text-[var(--red)]" : "text-emerald-800"}`} role={msg.error ? "alert" : "status"} data-testid="plan-promo-message">{msg.text}</p>}
    </form>
  );
};
