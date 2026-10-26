import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, TicketPercent } from "lucide-react";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { PromoCodeForm } from "@/components/admin/PromoCodeForm";

const fmt = (iso) => new Date(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Pacific/Auckland" });
const used = (n) => (n === null ? "Uses unavailable" : `Used ${n} ${n === 1 ? "time" : "times"}`);

const Row = ({ c }) => (
  <li className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-3 last:border-b-0" data-testid={`promo-row-${c.code}`}>
    <div className="min-w-0">
      <div className="truncate font-mono font-bold" data-testid={`promo-row-code-${c.code}`}>{c.code}</div>
      <div className="text-xs text-[var(--muted)]">{c.percent_off}% off first year · expires {fmt(c.expires_at)}</div>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
      <span className={`rounded-full px-2 py-0.5 font-bold ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`} data-testid={`promo-row-status-${c.code}`}>{c.active ? "Active" : "Expired"}</span>
      <span className="text-[var(--muted)]" data-testid={`promo-row-used-${c.code}`}>{used(c.times_redeemed)}</span>
    </div>
  </li>
);

export const PromoCodesAdmin = () => {
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.get("/admin/promo-codes").then(({ data: d }) => setData(d)).catch(() => { toast.error("Couldn't load promo codes"); setData({ base_price: null, codes: [] }); });
  }, []);

  const setFirst5000 = async (running) => {
    setData((d) => ({ ...d, first5000: running }));
    try {
      await api.put("/admin/promo-codes/first5000", { running });
      toast.success(running ? "FIRST5000 is running: new Pro sign-ups get 50% off their first year and first renewal" : "FIRST5000 stopped: new sign-ups pay the full price");
    } catch {
      setData((d) => ({ ...d, first5000: !running }));
      toast.error("Couldn't update FIRST5000");
    }
  };
  const save = async (body) => {
    const { data: c } = await api.post("/admin/promo-codes", body);
    setData((d) => ({ ...d, codes: [c, ...d.codes] }));
    setAdding(false);
    toast.success(`${c.code} is live: skippers can use it on the Stripe payment page`);
  };

  return (
    <section className="flex flex-col gap-3" data-testid="promo-codes-admin">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Create a discount code for Pro. Skippers enter it on the Stripe payment page, and any code that isn't on this list is rejected there.
      </p>
      {data && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-emerald-300 bg-emerald-50 p-3" data-testid="first5000-toggle">
          <Checkbox checked={!!data.first5000} onCheckedChange={(v) => setFirst5000(!!v)} className="mt-0.5 h-5 w-5" data-testid="first5000-checkbox" />
          <span className="flex flex-col gap-0.5">
            <b className="text-sm text-emerald-950">Promotion FIRST5000 is running</b>
            <span className="text-xs text-emerald-900">New Pro sign-ups get 50% off automatically (NZD {data.first5000_price?.toFixed(2) ?? "24.99"} instead of {data.base_price ? data.base_price.amount.toFixed(2) : "49.99"}) for their first year and first renewal, then full price. Promo codes still come off on top.</span>
          </span>
        </label>
      )}
      {adding ? <PromoCodeForm base={data?.base_price} first={data?.first5000 ? data.first5000_price : null} onSave={save} onCancel={() => setAdding(false)} />
        : <button type="button" className="btn-solid flex h-12 items-center justify-center gap-2" onClick={() => setAdding(true)} disabled={!data} data-testid="promo-new-btn"><TicketPercent className="h-5 w-5" /> New promo code or coupon</button>}
      {!data ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="promo-codes-list">
          {data.codes.length === 0 && <li className="p-4 text-center text-sm text-[var(--muted)]" data-testid="promo-codes-empty">No promo codes yet</li>}
          {data.codes.map((c) => <Row key={c.code} c={c} />)}
        </ul>
      )}
    </section>
  );
};
