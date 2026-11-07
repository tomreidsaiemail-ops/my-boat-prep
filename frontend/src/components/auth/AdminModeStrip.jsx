import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Signed in as admin: a red page and a strip on every screen, so admin edits are never made by accident.
export const AdminModeStrip = () => {
  const { user } = useAuth();
  const on = !!user?.is_admin;
  useEffect(() => {
    document.body.classList.toggle("admin-mode", on);
    return () => document.body.classList.remove("admin-mode");
  }, [on]);
  if (!on) return null;
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-[var(--red)] px-3 py-1.5 text-center text-xs font-extrabold uppercase tracking-wide text-white print:hidden" role="status" data-testid="admin-mode-strip">
      <ShieldAlert className="h-4 w-4 shrink-0" /> Admin mode: changes affect every skipper
    </div>
  );
};
