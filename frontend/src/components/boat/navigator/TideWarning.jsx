import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const TIDE_WARNING = "Tides are provided by WorldTides, and are inaccurate, and are not for navigation. Check official tide tables.";
export const localDay = () => new Date().toLocaleDateString("en-CA");

// Shown before any tides each day; ticking it hides it until tomorrow and notes it in the Ship's Log.
export const TideWarning = ({ testId }) => {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const ack = async () => {
    setBusy(true);
    const day = localDay();
    try { setUser((await api.put("/me/preferences", { tide_ack_date: day })).data); } catch { setUser({ ...user, tide_ack_date: day }); }
    const when = new Date().toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    window.dispatchEvent(new CustomEvent("mbp:log", { detail: `Tide warning acknowledged by ${user?.name || "the skipper"} on ${when}: ${TIDE_WARNING}` }));
  };
  return (
    <label className="-mt-1 flex cursor-pointer items-start gap-3 rounded-md border-2 border-[var(--red)] bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid={testId}>
      <input type="checkbox" checked={false} disabled={busy} onChange={ack} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--red)]" data-testid={`${testId}-checkbox`} />
      <span>{TIDE_WARNING}</span>
    </label>
  );
};
