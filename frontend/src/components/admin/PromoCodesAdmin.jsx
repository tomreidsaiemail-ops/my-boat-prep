import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, TicketPercent, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { PromoCodeForm } from "@/components/admin/PromoCodeForm";
import { PromoCodeLog } from "@/components/admin/PromoCodeLog";
import { First200Exceptions } from "@/components/admin/First200Exceptions";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

const fmt = (iso) => new Date(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Pacific/Auckland" });
const expiryText = (iso) => (new Date(iso).getFullYear() >= 9999 ? "never expires" : `expires ${fmt(iso)}`);
const used = (n) => (n === null ? "Uses unavailable" : `Used ${n} ${n === 1 ? "time" : "times"}`);

const Row = ({ c, onEdit, onDelete }) => (
  <li className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-3 last:border-b-0" data-testid={`promo-row-${c.code}`}>
    <div className="min-w-0 flex-1">
      <div className="truncate font-mono font-bold" data-testid={`promo-row-code-${c.code}`}>{c.code}</div>
      <div className="text-xs text-[var(--muted)]">{c.percent_off}% off first year · {expiryText(c.expires_at)}</div>
      {c.skipper_reward !== undefined && <div className="text-xs font-bold text-sky-800" data-testid={`promo-row-reward-${c.code}`}>Skipper reward: +{c.skipper_reward} Magic generations</div>}
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
      <span className={`rounded-full px-2 py-0.5 font-bold ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`} data-testid={`promo-row-status-${c.code}`}>{c.active ? "Active" : "Expired"}</span>
      <span className="text-[var(--muted)]" data-testid={`promo-row-used-${c.code}`}>{used(c.times_redeemed)}</span>
    </div>
    <div className="flex shrink-0 flex-col gap-1">
      <button type="button" className="icon-btn h-9 w-9" onClick={onEdit} aria-label={`Edit ${c.code}`} title="Edit" data-testid={`promo-row-edit-${c.code}`}><Pencil className="h-4 w-4" /></button>
      <button type="button" className="icon-btn h-9 w-9 hover:text-[var(--red)]" onClick={onDelete} aria-label={`Delete ${c.code}`} title="Delete" data-testid={`promo-row-delete-${c.code}`}><Trash2 className="h-4 w-4" /></button>
    </div>
  </li>
);

export const PromoCodesAdmin = () => {
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const load = () => api.get("/admin/promo-codes").then(({ data: d }) => setData(d));

  useEffect(() => {
    load().catch(() => { toast.error("Couldn't load promo codes"); setData({ base_price: null, codes: [], log: [] }); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setPromo = async (key, running) => {
    const label = key === "first200" ? "FIRST200" : "FIRST5000";
    const prev = data;
    setData((d) => ({ ...d, [key]: running, ...(running ? { [key === "first200" ? "first5000" : "first200"]: false } : {}) }));
    try {
      const { data: res } = await api.put(`/admin/promo-codes/${key}`, { running });
      setData((d) => ({ ...d, first5000: res.first5000, first200: res.first200 }));
      toast.success(!running ? `${label} stopped`
        : key === "first200" ? "FIRST200 is running: every skipper has Pro free, payments are hidden. FIRST5000 is off."
        : "FIRST5000 is running: new Pro sign-ups get 50% off their first year and first renewal. FIRST200 is off.");
    } catch {
      setData(prev);
      toast.error(`Couldn't update ${label}`);
    }
  };
  const save = async (body) => {
    const { data: c } = await api.post("/admin/promo-codes", body);
    setAdding(false);
    toast.success(`${c.code} is live: skippers can use it on the Stripe payment page`);
    load().catch(() => setData((d) => ({ ...d, codes: [c, ...d.codes] })));
  };
  const saveEdit = async ({ code, ...body }) => {
    const { data: d } = await api.put(`/admin/promo-codes/${code}`, body);
    setData(d);
    setEditing(null);
    toast.success(`${code} updated for new checkouts`);
  };
  const remove = async () => {
    const code = deleting.code;
    setDeleting(null);
    try {
      const { data: d } = await api.delete(`/admin/promo-codes/${code}`);
      setData(d);
      toast.success(`${code} deleted: it no longer works at checkout`);
    } catch (err) { toast.error(apiError(err, `Couldn't delete ${code}`)); }
  };

  return (
    <section className="flex flex-col gap-3" data-testid="promo-codes-admin">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Create a discount code for Pro. Skippers enter it on the Stripe payment page, and any code that isn't on this list is rejected there.
      </p>
      {data && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-sky-300 bg-sky-50 p-3" data-testid="first200-toggle">
          <Checkbox checked={!!data.first200} onCheckedChange={(v) => setPromo("first200", !!v)} className="mt-0.5 h-5 w-5" data-testid="first200-checkbox" />
          <span className="flex flex-col gap-0.5">
            <b className="text-sm text-sky-950">Promotion FIRST200 is running</b>
            <span className="text-xs text-sky-900">The app is free during its initial launch: every signed-in skipper gets Pro, and upgrade and payment are hidden. Paying Pro skippers keep their subscription. Turning this on turns FIRST5000 off.</span>
          </span>
        </label>
      )}
      {data && <First200Exceptions emails={data.first200_exceptions} onSaved={(list) => { setData((d) => ({ ...d, first200_exceptions: list })); load().catch(() => {}); }} />}
      {data && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-emerald-300 bg-emerald-50 p-3" data-testid="first5000-toggle">
          <Checkbox checked={!!data.first5000} onCheckedChange={(v) => setPromo("first5000", !!v)} className="mt-0.5 h-5 w-5" data-testid="first5000-checkbox" />
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
          {data.codes.map((c) => (editing === c.code
            ? <li key={c.code} className="p-2"><PromoCodeForm initial={c} base={data?.base_price} first={data?.first5000 ? data.first5000_price : null} onSave={saveEdit} onCancel={() => setEditing(null)} /></li>
            : <Row key={c.code} c={c} onEdit={() => setEditing(c.code)} onDelete={() => setDeleting(c)} />))}
        </ul>
      )}
      {data && <PromoCodeLog log={data.log} />}
      <ConfirmDelete item={deleting ? { name: deleting.code } : null} onClose={() => setDeleting(null)} onConfirm={remove} testId="promo-delete"
        note="The code stops working straight away and is removed from this list. Skippers who already used it keep their discount. The delete is logged." />
    </section>
  );
};
