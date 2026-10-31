import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

// Everyone who opened the app since local midnight, most recent first.
export const UsersTodayDialog = ({ open, onClose }) => {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setUsers(null); setError("");
    api.get("/admin/users-today", { params: { since: todayStart() } }).then(({ data }) => setUsers(data.users)).catch(() => setError("Couldn't load today's users. Check your signal."));
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-1.5rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-lg" data-testid="users-today-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Users today</DialogTitle>
          <DialogDescription>Everyone who opened the app since midnight, your time.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm font-bold text-[var(--red)]" data-testid="users-today-error">{error}</p>
          : !users ? <Loader2 className="mx-auto h-6 w-6 animate-spin" data-testid="users-today-loading" />
          : !users.length ? <p className="text-sm text-[var(--muted)]" data-testid="users-today-empty">No one has opened the app today yet.</p>
          : (
            <ul className="divide-y divide-[var(--line)]" data-testid="users-today-list">
              {users.map((u, i) => (
                <li key={u.email || i} className="flex items-start justify-between gap-3 py-2.5" data-testid={`users-today-row-${i}`}>
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words font-bold" data-testid={`users-today-name-${i}`}>{u.name || "No name"}</span>
                    <a href={`mailto:${u.email}`} className="break-all text-sm text-[var(--blue)] underline-offset-2 hover:underline" data-testid={`users-today-email-${i}`}>{u.email}</a>
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
