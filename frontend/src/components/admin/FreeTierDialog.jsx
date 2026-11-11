import { useEffect, useState } from "react";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

// Moving a paying or JOINCREW user to Free: warn that Stripe is cancelled now, and offer to let them use JOINCREW again.
export const FreeTierDialog = ({ user, onConfirm, onClose }) => {
  const [reset, setReset] = useState(false);
  useEffect(() => { setReset(false); }, [user]);
  return (
    <ConfirmDelete item={user ? { name: user.email } : null} danger={!!user?.has_subscription} testId="admin-free-confirm" title={`Move ${user?.email || ""} to Free?`}
      confirmLabel="Move to Free" cancelLabel="Keep" onClose={onClose} onConfirm={() => onConfirm(reset)}
      note={user?.has_subscription ? "They pay for Pro. Their Stripe plan is cancelled straight away, so they aren't charged again. There's no refund for time left." : "They become a normal Free user."}
      body={user?.joincrew_used ? (
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold" data-testid="admin-free-reset-joincrew">
          <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="admin-free-reset-joincrew-input" />
          Let them use JOINCREW again (their skippers keep the rewards they already got)
        </label>
      ) : null} />
  );
};
