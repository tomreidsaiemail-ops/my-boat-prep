import { useEffect, useState } from "react";
import { BadgePercent, X } from "lucide-react";
import { api } from "@/lib/api";

const HIDE_KEY = "mbp_first5000_hidden_until";
const WEEK = 7 * 24 * 60 * 60 * 1000;

// FIRST5000 launch banner; only renders while the admin has the promotion running.
export const First5000Banner = ({ variant = "app", onUpgrade }) => {
  const [offer, setOffer] = useState(null);
  const [hidden, setHidden] = useState(() => variant === "app" && Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now());
  useEffect(() => {
    if (hidden) return;
    api.get("/payments/offer/public").then(({ data }) => setOffer(data)).catch(() => {});
  }, [hidden]);
  if (hidden || !offer?.first5000) return null;
  const first = (offer.first5000_price ?? 24.99).toFixed(2);
  const full = (offer.price ?? 49.99).toFixed(2);
  const close = () => { localStorage.setItem(HIDE_KEY, String(Date.now() + WEEK)); setHidden(true); };
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
      {variant === "app" && (
        <button type="button" className="icon-btn -mr-1 -mt-1" onClick={close} aria-label="Hide for 7 days" title="Hide for 7 days" data-testid="first5000-banner-close-btn">
          <X className="h-5 w-5" />
        </button>
      )}
    </aside>
  );
};
