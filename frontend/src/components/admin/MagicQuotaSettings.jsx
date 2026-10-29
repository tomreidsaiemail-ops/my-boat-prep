import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

const Num = ({ label, value, onChange, step = 1, min = 0, testId, suffix }) => (
  <label className="flex flex-col gap-1 text-sm font-bold">{label}
    <span className="flex items-center gap-2">
      <input type="number" inputMode="decimal" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} className="field-input h-11 w-28" data-testid={testId} />
      {suffix && <span className="text-xs font-semibold text-[var(--muted)]">{suffix}</span>}
    </span>
  </label>
);

// Admin control for the shared daily Magic limit and the paid top-up pack; clients read these live from the server.
export const MagicQuotaSettings = () => {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/settings/quota").then(({ data }) => setForm(data)).catch(() => setForm({ error: true })); }, []);
  if (!form) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (form.error) return <p className="text-sm text-[var(--red)]">Couldn't load the Magic limit settings.</p>;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    const d = Number(form.daily_limit), n = Number(form.pack_size), p = Number(form.pack_price);
    const bn = Number(form.big_pack_size), bp = Number(form.big_pack_price);
    const bad = !Number.isInteger(d) || d < 0 || d > 1000 ? "Free per day must be a whole number from 0 to 1000"
      : !Number.isInteger(n) || n < 1 || n > 1000 ? "Top-up pack must be a whole number from 1 to 1000"
      : !(p >= 1 && p <= 500) ? "Pack price must be from 1 to 500"
      : !Number.isInteger(bn) || bn < 1 || bn > 5000 ? "Big pack must be a whole number from 1 to 5000"
      : !(bp >= 1 && bp <= 1000) ? "Big pack price must be from 1 to 1000" : "";
    if (bad) { toast.error(bad); return; }
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings/quota", { daily_limit: d, pack_size: n, pack_price: p, big_pack_size: bn, big_pack_price: bp });
      setForm(data);
      toast.success("Magic limit settings saved");
    } catch (e) { toast.error(apiError(e, "Couldn't save the settings")); } finally { setBusy(false); }
  };
  return (
    <section className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-4" data-testid="magic-quota-settings">
      <h2 className="text-base font-extrabold">Daily Magic limit and top-up</h2>
      <p className="text-xs text-[var(--muted)]">One shared daily limit covers every Magic feature (lists, Provisioning, Engineer, Doctor, Navigator and AI Scan). It resets at each skipper's local midnight. Changes apply straight away.</p>
      <div className="flex flex-wrap gap-4">
        <Num label="Free per day" value={form.daily_limit} onChange={set("daily_limit")} testId="quota-daily-limit-input" suffix="generations" />
        <Num label="Top-up pack" value={form.pack_size} onChange={set("pack_size")} min={1} testId="quota-pack-size-input" suffix="generations" />
        <Num label="Pack price" value={form.pack_price} onChange={set("pack_price")} step={0.5} min={1} testId="quota-pack-price-input" suffix={(form.currency || "").toUpperCase()} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Num label="Big pack" value={form.big_pack_size} onChange={set("big_pack_size")} min={1} testId="quota-big-pack-size-input" suffix="generations" />
        <Num label="Big pack price" value={form.big_pack_price} onChange={set("big_pack_price")} step={0.5} min={1} testId="quota-big-pack-price-input" suffix={(form.currency || "").toUpperCase()} />
      </div>
      <button type="button" className="btn-solid self-start px-5" disabled={busy} onClick={save} data-testid="quota-save-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
      </button>
    </section>
  );
};
