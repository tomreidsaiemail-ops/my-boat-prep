import { useEffect, useState } from "react";

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

// Shows a 2 second "Opening Store" bar, then opens the store in a new window (with a tap-to-open fallback if the browser blocks it).
export const OpeningStore = ({ url, onDone, onEdit }) => {
  const [go, setGo] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!url) return undefined;
    setGo(false);
    setBlocked(false);
    const r = requestAnimationFrame(() => setGo(true));
    const t = setTimeout(() => {
      const w = window.open(url, "_blank");
      if (w) { w.opener = null; onDone(); } else setBlocked(true);
    }, 2000);
    return () => { cancelAnimationFrame(r); clearTimeout(t); };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!url) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-lg border-2 border-[var(--navy)] bg-white p-4 shadow-xl" data-testid="opening-store">
      <p className="font-display text-lg font-extrabold">Opening Store</p>
      <p className="truncate text-xs text-[var(--muted)]" data-testid="opening-store-host">{hostOf(url)}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-[var(--navy)] [transition:width_2s_linear]" style={{ width: go ? "100%" : "0%" }} data-testid="opening-store-progress" />
      </div>
      {blocked && (
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={onDone} className="btn-solid mt-3 h-10 min-h-0 justify-center text-sm" data-testid="opening-store-open-link">
          Tap to open the store
        </a>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-ghost h-9 min-h-0 px-3 text-sm" onClick={onEdit} data-testid="opening-store-edit-btn">Edit link</button>
        <button type="button" className="btn-ghost h-9 min-h-0 px-3 text-sm" onClick={onDone} data-testid="opening-store-cancel-btn">Cancel</button>
      </div>
    </div>
  );
};
