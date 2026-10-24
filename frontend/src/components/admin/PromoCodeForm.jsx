import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const errText = (e) => {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return "Enter a discount between 1 and 100%";
  return "Couldn't reach Stripe, please check your signal";
};
const today = () => new Date().toLocaleDateString("en-CA");
const money = (n, cur) => `${cur} ${n.toFixed(2)}`;

const PricePreview = ({ base, pct }) => {
  if (!base) return <p className="text-xs text-[var(--muted)]" data-testid="promo-price-preview">Pro price unavailable right now</p>;
  const valid = pct > 0 && pct <= 100;
  const price = valid ? Math.round(base.amount * (100 - pct)) / 100 : base.amount;
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-[#f1f5f9] px-3 py-2" data-testid="promo-price-preview">
      <span className="field-label">Pro first year with this code</span>
      <span className="flex items-baseline gap-2">
        {valid && <s className="text-sm text-[var(--muted)]" data-testid="promo-preview-base">{money(base.amount, base.currency)}</s>}
        <b className="font-display text-2xl" data-testid="promo-preview-price">{money(price, base.currency)}</b>
      </span>
      <span className="text-xs text-[var(--muted)]" data-testid="promo-preview-note">
        {valid ? `Saves ${money(base.amount - price, base.currency)}. Renews at ${money(base.amount, base.currency)} a year.` : "Enter a discount to see the new price."}
      </span>
    </div>
  );
};

export const PromoCodeForm = ({ base, onSave, onCancel }) => {
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pctNum = Number(pct);

  const save = async (e) => {
    e.preventDefault();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { setError("Use 3 to 30 letters, numbers, - or _ for the code"); return; }
    if (!(pctNum > 0 && pctNum <= 100)) { setError("Enter a discount between 1 and 100%"); return; }
    if (!expires) { setError("Pick an expiry date"); return; }
    setBusy(true);
    setError("");
    try { await onSave({ code, percent_off: pctNum, expires_on: expires }); } catch (err) { setError(errText(err)); setBusy(false); }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-4" data-testid="promo-code-form">
      <label className="flex flex-col gap-1 text-sm font-bold">Coupon name / code
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={30} placeholder="e.g. SKIPPER20"
          className="field-input font-mono uppercase" autoCapitalize="characters" data-testid="promo-code-input" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">Discount (%)
          <input type="number" inputMode="decimal" min="1" max="100" step="any" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="20"
            className="field-input" data-testid="promo-percent-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">Expiry date
          <input type="date" min={today()} value={expires} onChange={(e) => setExpires(e.target.value)} className="field-input" data-testid="promo-expiry-input" />
        </label>
      </div>
      <PricePreview base={base} pct={pctNum} />
      <p className="text-xs text-[var(--muted)]">Skippers type the code on the Stripe payment page. The discount applies to their first year only, and the code stops working at the end of the expiry date (NZ time).</p>
      {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid="promo-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-5" onClick={onCancel} disabled={busy} data-testid="promo-cancel-btn">Cancel</button>
        <button type="submit" className="btn-solid px-5" disabled={busy} data-testid="promo-publish-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate &amp; Publish Code
        </button>
      </div>
    </form>
  );
};
