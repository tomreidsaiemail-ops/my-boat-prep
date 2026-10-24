import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TierBadge } from "@/components/boat/AccountMenu";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

const STAMP = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" };
const stamp = (iso, timeZone) => (iso ? new Date(iso).toLocaleString("en-NZ", { ...STAMP, timeZone }) : "");

const Joined = ({ u }) => (
  <span className="flex flex-col text-xs text-[var(--muted)]" data-testid={`admin-user-joined-${u.user_id}`}>
    {u.has_subscription && <span>Paid Pro until {fmt(u.pro_until)}</span>}
    <span>Joined {fmt(u.created_at)}</span>
    {u.created_at && <span className="font-mono" data-testid={`admin-user-joined-utc-${u.user_id}`}>{stamp(u.created_at, "UTC")}</span>}
    {u.created_at && <span className="font-mono" data-testid={`admin-user-joined-local-${u.user_id}`}>{stamp(u.created_at)} (local)</span>}
  </span>
);

const UserRow = ({ u, onRole, saving }) => (
  <li className="flex flex-col gap-2 border-b border-[var(--line)] p-3 last:border-b-0" data-testid={`admin-user-${u.user_id}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-bold"><span className="truncate">{u.name || "No name"}</span>{u.is_admin && <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--blue)]" aria-label="Admin" />}</div>
        <div className="truncate text-sm text-[var(--muted)]">{u.email}</div>
      </div>
      <TierBadge role={u.role} />
    </div>
    <div className="flex items-center justify-between gap-3">
      <Joined u={u} />
      <div className="flex items-center gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        <select value={u.role} onChange={(e) => onRole(u, e.target.value)} disabled={saving} aria-label={`Tier for ${u.email}`}
          className="field-input h-10 w-36 py-0 text-sm" data-testid={`admin-role-select-${u.user_id}`}>
          <option value="free">Free</option>
          <option value="beta_tester">Beta tester</option>
          <option value="pro">Pro</option>
        </select>
      </div>
    </div>
  </li>
);

export default function Admin() {
  const { user, refresh } = useAuth();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    api.get("/admin/users").then(({ data }) => setUsers(data)).catch(() => { toast.error("Couldn't load users. Check your signal."); setUsers([]); });
  }, []);

  const shown = useMemo(() => (users || []).filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())), [users, q]);
  const counts = useMemo(() => (users || []).reduce((c, u) => ({ ...c, [u.role]: (c[u.role] || 0) + 1 }), {}), [users]);

  const setRole = async (u, role) => {
    setSaving(u.user_id);
    try {
      const { data } = await api.patch(`/admin/users/${u.user_id}`, { role });
      setUsers((list) => list.map((x) => (x.user_id === u.user_id ? data : x)));
      toast.success(`${u.email} is now ${role === "beta_tester" ? "a Beta tester" : role === "pro" ? "Pro" : "Free"}`);
      if (u.user_id === user.user_id) refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't change the tier");
    } finally {
      setSaving(null);
    }
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-5" data-testid="admin-page">
      <Link to="/" className="btn-ghost self-start px-4" data-testid="admin-back-btn"><ArrowLeft className="h-4 w-4" /> Back to lists</Link>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">User tiers</h1>
      <p className="text-sm text-[var(--muted)]" data-testid="admin-counts">
        {users ? `${users.length} users: ${counts.free || 0} Free, ${counts.beta_tester || 0} Beta, ${counts.pro || 0} Pro` : "Loading..."}
      </p>
      <label className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="field-input w-full !pl-9" data-testid="admin-search-input" />
      </label>
      {!users ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="admin-user-list">
          {shown.length === 0 && <li className="p-4 text-center text-sm text-[var(--muted)]">No users found</li>}
          {shown.map((u) => <UserRow key={u.user_id} u={u} onRole={setRole} saving={saving === u.user_id} />)}
        </ul>
      )}
    </main>
  );
}
