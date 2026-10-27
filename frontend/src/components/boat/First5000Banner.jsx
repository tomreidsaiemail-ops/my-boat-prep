import { useEffect, useState } from "react";
import { BadgePercent, PartyPopper, X } from "lucide-react";
import { api } from "@/lib/api";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const hideKey = (promo) => `mbp_${promo}_hidden_until`;

const Close = ({ onClick }) => (
  <button type="button" className="icon-btn -mr-1 -mt-1" onClick={onClick} aria-label="Hide for 7 days" title="Hide for 7 days" data-testid="first5000-banner-close-btn">
    <X className="h-5 w-5" />
  </button>
);

// Launch banner: FIRST200 (free for everyone) or FIRST5000 (50% off), only while the admin has one running.
export const First5000Banner = ({ variant = "app", onUpgrade }) => {
  const [offer, setOffer] = useState(null);
  const [hiddenAt, setHiddenAt] = useState(0);
  useEffect(() => { api.get("/payments/offer/public").then(({ data }) => setOffer(data)).catch(() => {}); }, []);
  const promo = offer?.first200 ? "first200" : offer?.first5000 ? "first5000" : null;
  if (!promo) return null;
  if (variant === "app" && Math.max(hiddenAt, Number(localStorage.getItem(hideKey(promo)) || 0)) > Date.now()) return null;
  const close = () => { const until = Date.now() + WEEK; localStorage.setItem(hideKey(promo), String(until)); setHiddenAt(until); };
  if (promo === "first200") {
    return (
      <aside className="mbp-pop flex items-start gap-3 rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3 text-emerald-950" data-testid={`first200-banner-${variant}`}>
        <PartyPopper className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <b className="font-display text-base font-extrabold tracking-tight" data-testid="first200-banner-title">FIRST200: My Boat Prep is free during our launch</b>
          <span className="text-sm" data-testid="first200-banner-text">
            Every Pro feature is unlocked for everyone while our first skippers try the app out. No payment needed, just sign in and get your boat ready.
          </span>
        </div>
        {variant === "app" && <Close onClick={close} />}
      </aside>
    );
  }
  const first = (offer.first5000_price ?? 24.99).toFixed(2);
  const full = (offer.price ?? 49.99).toFixed(2);
  return (
    <aside className="mbp-pop flex items-start gap-3 rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3 text-emerald-950" data-testid={`first5000-banner-${variant}`}>
      <BadgePercent className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="font-display text-base font-extrabold tracking-tight" data-testid="first5000-banner-title">FIRST5000: 50% off Pro</b>
        <span className="text-sm" data-testid="first5000-banner-text">
          NZD {first} for your first year and again at your first renewal (normally NZD {full}). Promo codes come off on top.
        </span>
        {onUpgrade && (
          <button type="button" className="btn-solid mt-1 h-10 self-start px-4 text-sm" onClick={onUpgrade} data-testid="first5000-banner-upgrade-btn">Get 50% off Pro</button>
        )}
      </div>
      {variant === "app" && <Close onClick={close} />}
    </aside>
  );
};
