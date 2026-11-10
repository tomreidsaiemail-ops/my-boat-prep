import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const SHORE = { sending: ["Emailing your shore contact...", Loader2, "animate-spin text-[var(--muted)]"], sent: ["Shore contact emailed", CheckCircle2, "text-[var(--green)]"], failed: ["Could not email your shore contact, tap to retry", XCircle, "text-[var(--red)]"] };

export const DistressEmailBar = ({ online, status, onRetryShore }) => {
  if (!online || !status) return null;
  const [text, Icon, cls] = SHORE[status];
  return (
    <button type="button" onClick={onRetryShore} disabled={status !== "failed"} data-testid="shore-distress-status" data-status={status}
      className="flex items-center gap-1.5 self-start text-xs font-bold text-[var(--navy)] disabled:cursor-default">
      <Icon className={`h-4 w-4 ${cls}`} />{text}
    </button>
  );
};
