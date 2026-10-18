import { useEffect, useRef } from "react";

const CLIENT = process.env.REACT_APP_ADSENSE_CLIENT;
const SLOT = process.env.REACT_APP_ADSENSE_SLOT;

const useAdSense = (enabled, slot) => {
  const pushed = useRef(false);
  useEffect(() => {
    if (!enabled || pushed.current) return undefined;
    if (!document.querySelector("script[data-mbp-adsense]")) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      s.crossOrigin = "anonymous";
      s.dataset.mbpAdsense = "1";
      document.head.appendChild(s);
    }
    // Push a little later, and only for this slot, so a quick remount never queues an ad without its slot.
    const t = setTimeout(() => {
      const el = slot.current;
      if (!el?.isConnected || el.dataset.adsbygoogleStatus) return;
      pushed.current = true;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ad blockers or unfilled slots */ }
    }, 300);
    return () => clearTimeout(t);
  }, [enabled, slot]);
};

export const AdBanner = ({ online, onRemoveAds }) => {
  const live = !!(CLIENT && SLOT && online);
  const slot = useRef(null);
  useAdSense(live, slot);
  if (!online) return null;
  return (
    <aside className="mbp-ad flex flex-col gap-1.5" data-testid="ad-banner">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Advertisement</span>
        <button type="button" onClick={onRemoveAds} className="text-xs font-bold text-[var(--blue)] hover:underline" data-testid="ad-remove-btn">Remove ads with Pro</button>
      </div>
      {live ? (
        <ins ref={slot} className="adsbygoogle block min-h-[90px]" data-ad-client={CLIENT} data-ad-slot={SLOT} data-ad-format="horizontal" data-full-width-responsive="true" data-testid="ad-slot" />
      ) : (
        <div className="flex min-h-[90px] items-center justify-center rounded-lg border-[1.5px] border-dashed border-[var(--line)] bg-white text-sm font-semibold text-[var(--muted)]" data-testid="ad-placeholder">
          Ad space (Google AdSense)
        </div>
      )}
    </aside>
  );
};
