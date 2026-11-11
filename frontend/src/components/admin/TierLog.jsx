import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const LABEL = { free: "Free", beta_tester: "Beta tester", pro: "Pro" };
const when = (iso) => new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const Entries = ({ log, showEmail, testId }) => (
  <ul className="flex flex-col divide-y divide-[var(--line)]" data-testid={testId}>
    {log.length === 0 && <li className="py-2 text-xs text-[var(--muted)]" data-testid={`${testId}-empty`}>No tier changes yet</li>}
    {log.map((l, n) => (
      <li key={`${l.at}-${n}`} className="flex flex-col py-1.5 text-xs" data-testid={`${testId}-row-${n}`}>
        <span className="font-mono text-[var(--muted)]">{when(l.at)} · by {l.by}</span>
        <span>
          {showEmail && <b className="break-all">{l.email} </b>}
          {l.to ? <><b>{LABEL[l.from] || l.from}</b> → <b>{LABEL[l.to] || l.to}</b></> : <b>{LABEL[l.from] || l.from}</b>}
          {l.note && <span className="text-[var(--muted)]"> · {l.note}</span>}
        </span>
      </li>
    ))}
  </ul>
);

// Under each user on User tiers: their own tier history, loaded when opened.
export const UserTierHistory = ({ userId, version }) => {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState(null);
  useEffect(() => {
    if (open) api.get("/admin/tier-log", { params: { user_id: userId, limit: 200 } }).then(({ data }) => setLog(data.log)).catch(() => setLog([]));
  }, [open, userId, version]);
  return (
    <div data-testid={`admin-user-history-${userId}`}>
      <button type="button" className="flex items-center gap-1 text-xs font-bold text-[var(--navy)] underline underline-offset-2" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`admin-user-history-toggle-${userId}`}>
        <History className="h-3.5 w-3.5" /> {open ? "Hide tier history" : "Tier history"}
      </button>
      {open && (log ? <Entries log={log} testId={`admin-user-history-list-${userId}`} /> : <Loader2 className="h-4 w-4 animate-spin" />)}
    </div>
  );
};

// Bottom of User tiers: every tier change, newest first.
export const TierLog = ({ version }) => {
  const [all, setAll] = useState(false);
  const [log, setLog] = useState(null);
  useEffect(() => {
    api.get("/admin/tier-log", { params: { limit: all ? 5000 : 100 } }).then(({ data }) => setLog(data.log)).catch(() => setLog([]));
  }, [all, version]);
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="admin-tier-log">
      <b className="flex items-center gap-1.5 text-sm"><History className="h-4 w-4" /> Tier change log</b>
      {log ? <Entries log={log} showEmail testId="admin-tier-log-list" /> : <Loader2 className="h-4 w-4 animate-spin" />}
      {!all && log?.length === 100 && <button type="button" className="btn-ghost h-10 self-start px-4 text-sm" onClick={() => setAll(true)} data-testid="admin-tier-log-all-btn">Show the full log</button>}
    </section>
  );
};
