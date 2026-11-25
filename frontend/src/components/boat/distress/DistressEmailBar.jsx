import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const SHORE = { sending: ["Emailing your shore contact...", Loader2, "animate-spin text-[var(--muted)]"], sent: ["Shore contact emailed.", CheckCircle2, "text-[var(--green)]"], failed: ["Could not email your shore contact, tap to retry", XCircle, "text-[var(--red)]"] };

// One line where the Confirm line was: the shore email's progress, then any texts delivered, each number tappable to ring that shore contact.
// A text that is still sending or failed shows nothing, so the VHF call comes first.
export const DistressEmailBar = ({ online, status, sms, onRetryShore }) => {
  const to = sms?.status === "delivered" ? sms.to || [] : [];
  const email = online && status ? SHORE[status] : null;
  if (!email && !to.length) return null;
  const [text, Icon, cls] = email || ["", CheckCircle2, "text-[var(--green)]"];
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 self-start text-xs font-bold text-[var(--navy)]" data-testid="shore-distress-status" data-status={status || ""}>
      <Icon className={`h-4 w-4 shrink-0 ${cls}`} />
      {email && (status === "failed"
        ? <button type="button" onClick={onRetryShore} className="underline underline-offset-2" data-testid="shore-distress-retry-btn">{text}</button>
        : <span data-testid="shore-distress-email">{text}</span>)}
      {to.length > 0 && (
        <span data-testid="shore-distress-sms">
          {to.length > 1 ? "Texts to " : "Text to "}
          {to.map((n, i) => <span key={n}>{i ? ", " : ""}<a href={`tel:${n}`} className="underline decoration-2 underline-offset-2" data-testid={`shore-distress-sms-call-${i}`}>{n}</a></span>)}
          {" "}successful.
        </span>
      )}
    </p>
  );
};
