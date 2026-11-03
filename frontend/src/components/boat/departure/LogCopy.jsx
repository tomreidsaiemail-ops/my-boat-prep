// The "copy into the Ship's Log" tick shared by the departure and arrival checks; flags a copied entry that is out of date.
export const LogCopy = ({ label, logged, blocked, outdated, onToggle, onRelog, prefix }) => (
  <label className={`flex items-start gap-2 text-sm ${blocked && !logged ? "opacity-60" : "cursor-pointer"}`}>
    <input type="checkbox" checked={logged} disabled={!!blocked && !logged} onChange={(e) => onToggle(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${prefix}-log-checkbox`} />
    <span><b>{label}</b>
      {blocked && !logged && <span className="block text-xs text-[var(--muted)]" data-testid={`${prefix}-log-blocked`}>{blocked}</span>}
      {logged && !outdated && <span className="block text-xs text-emerald-700" data-testid={`${prefix}-logged`}>Copied to the Ship&apos;s Log. Untick to take it out again.</span>}
      {outdated && (
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-amber-800" data-testid={`${prefix}-log-outdated`}>
          Changed since it was copied.
          <button type="button" className="btn-ghost h-8 min-h-0 px-2.5 text-xs" disabled={!!blocked} onClick={(e) => { e.preventDefault(); onRelog(); }} data-testid={`${prefix}-relog-btn`}>Update the Ship&apos;s Log</button>
          {blocked && <span className="font-normal text-[var(--muted)]">{blocked}</span>}
        </span>
      )}
    </span>
  </label>
);

export const stamp = () => new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
