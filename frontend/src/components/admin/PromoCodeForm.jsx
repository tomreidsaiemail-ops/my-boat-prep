import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const errText = (e) => {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return "Enter a discount above 0 and up to 100%";
  return "Couldn't reach Stripe, please check your signal";
};
const today = () => new Date().toLocaleDateString("en-CA");
const money = (n, cur) => `${cur} ${n.toFixed(2)}`;

const PricePreview = ({ base, pct, first }) => {
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
        {valid && first ? <span className="block font-bold text-emerald-800" data-testid="promo-preview-first5000">FIRST5000 skippers: {money(first, base.currency)} becomes {money(Math.round(first * (100 - pct)) / 100, base.currency)} this year.</span> : null}
      </span>
    </div>
  );
};

const nzDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });

export const PromoCodeForm = ({ base, first, initial, onSave, onCancel }) => {
  const [code, setCode] = useState(initial?.code || "");
  const [pct, setPct] = useState(initial ? String(initial.percent_off) : "");
  const [expires, setExpires] = useState(initial ? nzDay(initial.expires_at) : "");
  const [reward, setReward] = useState(String(initial?.skipper_reward ?? 10));
  const joincrew = code === "JOINCREW";
  const rewardNum = Number(reward);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pctNum = Number(pct);

  const save = async (e) => {
    e.preventDefault();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { setError("Use 3 to 30 letters, numbers, - or _ for the code"); return; }
    if (!(pctNum > 0 && pctNum <= 100)) { setError("Enter a discount above 0 and up to 100%"); return; }
    if (!expires) { setError("Pick an expiry date"); return; }
    if (joincrew && !(Number.isInteger(rewardNum) && rewardNum >= 0 && rewardNum <= 1000)) { setError("Enter a skipper reward from 0 to 1000 Magic generations"); return; }
    setBusy(true);
    setError("");
    try { await onSave({ code, percent_off: pctNum, expires_on: expires, ...(joincrew ? { skipper_reward: rewardNum } : {}) }); } catch (err) { setError(errText(err)); setBusy(false); }
  };

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-4" data-testid={initial ? `promo-edit-form-${initial.code}` : "promo-code-form"}>
      <label className="flex flex-col gap-1 text-sm font-bold">Coupon name / code
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={30} placeholder="e.g. SKIPPER20" readOnly={!!initial}
          className={`field-input font-mono uppercase ${initial ? "bg-slate-100" : ""}`} autoCapitalize="characters" data-testid="promo-code-input" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">Discount (%)
          <input type="number" inputMode="decimal" min="0.01" max="100" step="any" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="20"
            className="field-input" data-testid="promo-percent-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">Expiry date
          <input type="date" min={today()} value={expires} onChange={(e) => setExpires(e.target.value)} className="field-input" data-testid="promo-expiry-input" />
        </label>
      </div>
      {joincrew && (
        <label className="flex flex-col gap-1 text-sm font-bold">Skipper reward (Magic generations)
          <input type="number" inputMode="numeric" min="0" max="1000" step="1" value={reward} onChange={(e) => setReward(e.target.value)} className="field-input" data-testid="promo-reward-input" />
          <span className="text-xs font-normal text-[var(--muted)]">Added once to each skipper whose crew uses JOINCREW. Default 10.</span>
        </label>
      )}
      <PricePreview base={base} pct={pctNum} first={first} />
      {initial && <p className="text-xs font-bold text-amber-800" data-testid="promo-edit-note">Changes apply to new checkouts only. Skippers who already used this code keep what they paid.</p>}
      <p className="text-xs text-[var(--muted)]">Skippers type the code on the Stripe payment page. The discount applies to their first year only, and the code stops working at the end of the expiry date (NZ time). Pick 31/12/9999 for a code that never expires.</p>
      {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid="promo-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-5" onClick={onCancel} disabled={busy} data-testid="promo-cancel-btn">Cancel</button>
        <button type="submit" className="btn-solid px-5" disabled={busy} data-testid="promo-publish-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {initial ? "Save changes" : <>Generate &amp; Publish Code</>}
        </button>
      </div>
    </form>
  );
};
