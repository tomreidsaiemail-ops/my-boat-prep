import { useEffect } from "react";
import { hidePromo } from "@/components/boat/First5000Banner";

const PROMOS = '[data-testid="first200-banner-app"], [data-testid="first5000-banner-app"]';

// First thing on Welcome: a showing promotion is highlighted, and Continue hides it (7 days) to make room.
export const PromoFirst = () => {
  useEffect(() => {
    const els = [...document.querySelectorAll(PROMOS)];
    els.forEach((e) => e.classList.add("mbp-glow"));
    els[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => els.forEach((e) => e.classList.remove("mbp-glow"));
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-3" data-testid="welcome-promo-first">
      <p className="min-w-0 flex-1 text-sm font-bold" data-testid="welcome-promo-text">You have a promotion showing press Continue.</p>
      <button type="button" className="btn-solid mbp-glow h-11 shrink-0 px-5 !text-[var(--navy)]" onClick={hidePromo} data-testid="welcome-promo-continue-btn">Continue</button>
    </div>
  );
};
