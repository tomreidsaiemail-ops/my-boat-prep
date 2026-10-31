import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { todayStart, UsersTodayDialog } from "@/components/admin/UsersTodayDialog";

const REFRESH_MS = 30000;
export const fmtTokens = (n = 0) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`);
export const fmtCost = (c = 0, cur = "USD") => `${cur === "USD" ? "$" : `${cur} `}${c < 0.01 && c > 0 ? c.toFixed(4) : c.toFixed(2)}`;
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const Tile = ({ label, value, sub, testId, onClick }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`flex flex-col gap-0.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white px-3 py-3 text-left ${onClick ? "cursor-pointer hover:border-[var(--navy)] active:scale-[.98] [transition:border-color_.15s,transform_.1s]" : ""}`} data-testid={testId}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="font-display text-2xl font-extrabold tabular-nums" data-testid={`${testId}-value`}>{value}</span>
      {sub && <span className="text-xs text-[var(--muted)]" data-testid={`${testId}-sub`}>{sub}</span>}
    </Tag>
  );
};

const Section = ({ title, children, testId }) => (
  <section className="flex flex-col gap-2" data-testid={testId}>
    <h2 className="font-display text-base font-extrabold uppercase tracking-tight md:text-lg">{title}</h2>
    <div className="grid grid-cols-2 gap-2">{children}</div>
  </section>
);

const PricingForm = ({ pricing, onSaved }) => {
  const [form, setForm] = useState(pricing);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(pricing), [pricing]);
  const save = async (e) => {
    e.preventDefault();
    if (form.input_per_m === "" || form.output_per_m === "") { toast.error("Enter both token prices"); return; }
    setBusy(true);
    try { await api.put("/admin/compute-pricing", { input_per_m: Number(form.input_per_m), output_per_m: Number(form.output_per_m), currency: form.currency }); toast.success("Token prices saved"); onSaved(); }
    catch (err) { toast.error(apiError(err, "Couldn't save the prices")); }
    finally { setBusy(false); }
  };
  const field = (k, label) => (
    <label className="flex flex-col gap-1 text-xs font-bold">{label}
      <input type="number" min="0" step="0.01" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="field-input" data-testid={`pricing-${k}-input`} />
    </label>
  );
  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-[var(--line)] p-3" data-testid="pricing-form">
      <p className="text-sm font-bold">Estimated cost uses these prices per million tokens</p>
      <div className="grid grid-cols-3 gap-2">
        {field("input_per_m", "Input")}
        {field("output_per_m", "Output")}
        <label className="flex flex-col gap-1 text-xs font-bold">Currency
          <input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="field-input" data-testid="pricing-currency-input" />
        </label>
      </div>
      <button type="submit" className="btn-solid h-10 justify-center" disabled={busy} data-testid="pricing-save-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save prices"}</button>
    </form>
  );
};

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/analytics", { params: { since: todayStart() } }).then(({ data: d }) => setData(d)).catch(() => toast.error("Couldn't load analytics. Check your signal.")).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);

  const cur = data?.pricing.currency;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-16 pt-5" data-testid="admin-analytics-page">
      <Link to="/" className="btn-ghost self-start px-4" data-testid="analytics-back-btn"><ArrowLeft className="h-4 w-4" /> Back to lists</Link>
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Analytics</h1>
        <button type="button" className="btn-ghost h-10 gap-2 px-3 text-sm" onClick={load} disabled={loading} data-testid="analytics-refresh-btn">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {!data ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <>
          <p className="-mt-3 text-xs text-[var(--muted)]" data-testid="analytics-updated">Updates every 30 seconds · last {new Date(data.generated_at).toLocaleTimeString("en-NZ")} · "This month" from {new Date(data.month_start).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</p>
          <Section title="Growth & monetisation" testId="analytics-growth">
            <Tile label="Total users" value={data.growth.users} testId="tile-users" />
            <Tile label="Users today" value={data.growth.users_today} sub="opened the app today · tap to see who" onClick={() => setToday(true)} testId="tile-users-today" />
            <Tile label="Users this month" value={data.growth.users_month} testId="tile-users-month" />
            <Tile label="Total Pro users" value={data.growth.pro} sub="paid or promo Pro accounts" testId="tile-pro" />
            <Tile label="Pro users this month" value={data.growth.pro_month} testId="tile-pro-month" />
          </Section>
          <Section title="Compute & token economics" testId="analytics-compute">
            <Tile label="Compute all-time" value={fmtTokens(data.compute.all.tokens)} sub={`${fmtCost(data.compute.all.cost, cur)} · ${plural(data.compute.all.uses, "AI call")}`} testId="tile-compute-all" />
            <Tile label="Compute this month" value={fmtTokens(data.compute.month.tokens)} sub={`${fmtCost(data.compute.month.cost, cur)} · ${plural(data.compute.month.uses, "AI call")}`} testId="tile-compute-month" />
            <Tile label="Average per user" value={fmtTokens(data.compute.avg_per_user.tokens)} sub={`${fmtCost(data.compute.avg_per_user.cost, cur)} across all users`} testId="tile-compute-avg" />
            <Tile label="Users of any Magic" value={data.compute.ai_users} testId="tile-ai-users" />
          </Section>
          <Section title="The Magic Suite" testId="analytics-features">
            {data.features.map((f) => (
              <Tile key={f.code} label={`${f.code} users`} value={f.users} testId={`tile-feature-${f.code}`}
                sub={`${f.name} · ${f.users_month} this month · ${plural(f.uses, "use")} (${f.uses_month} this month) · ${fmtTokens(f.tokens)} tokens`} />
            ))}
          </Section>
          <p className="text-xs text-[var(--muted)]">Uses before token tracking started are counted, with 0 tokens.</p>
          <PricingForm pricing={data.pricing} onSaved={load} />
          <UsersTodayDialog open={today} onClose={() => setToday(false)} />
        </>
      )}
    </main>
  );
}
