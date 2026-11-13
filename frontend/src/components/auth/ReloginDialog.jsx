import { useEffect, useRef, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { clearAppCaches, SYNC_EVENT, syncStatus, UPDATED_PARAM } from "@/lib/appUpdate";

const SECONDS = 60;
const changes = (n) => `${n} change${n === 1 ? "" : "s"}`;

const SyncNote = ({ mode, sync }) => {
  if (!sync.pending) return null;
  const text = mode === "rejected" ? `Your ${changes(sync.pending)} not yet saved stay on this phone and save once you sign in again.`
    : sync.online ? `Saving ${changes(sync.pending)} to the cloud first...`
      : `Waiting for signal to save ${changes(sync.pending)} first. Set Status to Online if it is off. Nothing is lost.`;
  return <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900" data-testid="relogin-sync-note">{text}</p>;
};

// Major update: a one-minute countdown, then caches are cleared and the user signs in again (after unsaved changes sync).
export const ReloginDialog = ({ mode }) => {
  const { logout } = useAuth();
  const [left, setLeft] = useState(SECONDS);
  const [tapped, setTapped] = useState(false);
  const [sync, setSync] = useState(syncStatus);
  const leaving = useRef(false);
  useEffect(() => {
    const on = () => setSync(syncStatus());
    window.addEventListener(SYNC_EVENT, on);
    return () => window.removeEventListener(SYNC_EVENT, on);
  }, []);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const waiting = mode === "stale" && sync.pending > 0;
  const ready = (left <= 0 || tapped) && !waiting;
  useEffect(() => {
    if (!ready || leaving.current) return;
    leaving.current = true;
    (async () => {
      await clearAppCaches();
      await logout();
      window.location.replace(`/login?${UPDATED_PARAM}=1`);
    })();
  }, [ready, logout]);
  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-md" data-testid="relogin-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="relogin-title">My Boat Prep has been updated</AlertDialogTitle>
          <AlertDialogDescription>For safety, everyone signs in again after this update.</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-center font-display text-4xl font-extrabold tabular-nums" data-testid="relogin-countdown">
          0:{String(Math.max(0, left)).padStart(2, "0")}
        </p>
        <p className="text-center text-sm text-[var(--muted)]">{left > 0 ? "Signing you out when this reaches 0:00." : "Signing you out..."}</p>
        <SyncNote mode={mode} sync={sync} />
        <AlertDialogFooter>
          <button type="button" className="btn-solid w-full px-5" disabled={tapped} onClick={() => setTapped(true)} data-testid="relogin-now-btn">
            {tapped ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}Sign in again
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
