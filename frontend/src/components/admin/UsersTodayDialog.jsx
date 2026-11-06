import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
export const yesterdayStart = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d.toISOString(); };

const DAYS = {
  today: { title: "Users today", path: "/admin/users-today", what: "since midnight, your time", none: "No one has opened the app today yet.", err: "today's" },
  yesterday: { title: "Users yesterday", path: "/admin/users-yesterday", what: "yesterday, midnight to midnight your time. The time is their last visit that day", none: "No one opened the app yesterday.", err: "yesterday's" },
};

// Everyone who opened the app today (or yesterday), most recent first.
export const UsersTodayDialog = ({ open, day = "today", onClose }) => {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const d = DAYS[day];
  const t = `users-${day}`;
  useEffect(() => {
    if (!open) return;
    setUsers(null); setError("");
    api.get(d.path, { params: { since: todayStart(), yesterday: yesterdayStart() } }).then(({ data }) => setUsers(data.users)).catch(() => setError(`Couldn't load ${d.err} users. Check your signal.`));
  }, [open, day]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-1.5rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-lg" data-testid={`${t}-dialog`}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{d.title}</DialogTitle>
          <DialogDescription>Everyone who opened the app {d.what}.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm font-bold text-[var(--red)]" data-testid={`${t}-error`}>{error}</p>
          : !users ? <Loader2 className="mx-auto h-6 w-6 animate-spin" data-testid={`${t}-loading`} />
          : !users.length ? <p className="text-sm text-[var(--muted)]" data-testid={`${t}-empty`}>{d.none}</p>
          : (
            <ul className="divide-y divide-[var(--line)]" data-testid={`${t}-list`}>
              {users.map((u, i) => (
                <li key={u.email || i} className="flex items-start justify-between gap-3 py-2.5" data-testid={`${t}-row-${i}`}>
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words font-bold" data-testid={`${t}-name-${i}`}>{u.name || "No name"}</span>
                    <a href={`mailto:${u.email}`} className="break-all text-sm text-[var(--blue)] underline-offset-2 hover:underline" data-testid={`${t}-email-${i}`}>{u.email}</a>
                  </span>
                  <span className="shrink-0 text-right text-xs text-[var(--muted)]">
                    {new Date(u.last_seen).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    <span className="block uppercase">{u.role.replace("_", " ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
      </DialogContent>
    </Dialog>
  );
};
