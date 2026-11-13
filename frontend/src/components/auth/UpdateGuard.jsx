import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CHECK_EVENT, newBuildOnServer, reloadFresh } from "@/lib/appUpdate";
import { ReloginDialog } from "@/components/auth/ReloginDialog";

const RELOAD_KEY = "mbp_reloaded_for";
const SEEN_KEY = "mbp_update_notice_seen";
const CHECK_MS = 5 * 60 * 1000;
const WHEN = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false };

const ScheduledBanner = ({ status }) => {
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY));
  const at = status.relogin_at;
  if (!at || new Date(at) <= new Date(status.server_time) || seen === at) return null;
  const ok = () => { localStorage.setItem(SEEN_KEY, at); setSeen(at); };
  return (
    <div className="sticky top-0 z-[55] flex items-start gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-950 print:hidden" role="status" data-testid="scheduled-update-banner">
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">
        <b data-testid="scheduled-update-time">App update {new Date(at).toLocaleString("en-NZ", WHEN)}.</b> Everyone will be signed out and asked to sign in again. Save your changes with signal before then.
        {status.note && <span className="block" data-testid="scheduled-update-note">{status.note}</span>}
      </p>
      <button type="button" className="shrink-0 font-extrabold underline" onClick={ok} data-testid="scheduled-update-ok-btn">Got it</button>
    </div>
  );
};

// Checks the server on open, on return to the app and on reconnect: new builds reload, scheduled sign-outs log out.
export const UpdateGuard = () => {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const [status, setStatus] = useState(null);
  const [forced, setForced] = useState(null);

  const check = useCallback(async (first = false) => {
    if (!navigator.onLine || document.visibilityState === "hidden") return;
    try {
      const { data } = await api.get("/app/status", { timeout: 8000 });
      setStatus(data);
      const passed = data.relogin_at && new Date(data.relogin_at) <= new Date(data.server_time);
      const gone = userRef.current && data.session === "none" && passed;
      if (userRef.current && (data.session === "stale" || data.session === "rejected" || gone)) { setForced(data.session === "stale" ? "stale" : "rejected"); return; }
    } catch { return; }
    const main = await newBuildOnServer();
    if (!main) return;
    if (first && sessionStorage.getItem(RELOAD_KEY) !== main) { sessionStorage.setItem(RELOAD_KEY, main); reloadFresh(); return; }
    toast("A new version of My Boat Prep is ready", {
      id: "app-update", duration: Infinity, description: "Reload to use it. Your changes are kept.", action: { label: "Reload", onClick: reloadFresh },
    });
  }, []);

  useEffect(() => {
    check(true);
    const again = () => check();
    const visible = () => document.visibilityState === "visible" && check();
    window.addEventListener("online", again);
    window.addEventListener(CHECK_EVENT, again);
    document.addEventListener("visibilitychange", visible);
    const t = setInterval(again, CHECK_MS);
    return () => { window.removeEventListener("online", again); window.removeEventListener(CHECK_EVENT, again); document.removeEventListener("visibilitychange", visible); clearInterval(t); };
  }, [check]);

  useEffect(() => { if (user && !forced) check(); }, [user?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // While waiting to sign out, keep asking so a lapsed grace period never leaves someone stuck.
  useEffect(() => {
    if (forced !== "stale") return undefined;
    const t = setInterval(() => check(), 30000);
    return () => clearInterval(t);
  }, [forced, check]);

  if (forced && user) return <ReloginDialog key={forced} mode={forced} />;
  return user && status ? <ScheduledBanner status={status} /> : null;
};
