import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";

const CG = {
  sending: { cls: "border-[var(--red)] bg-[var(--red)] text-white", Icon: Loader2, spin: true, text: "Sending to Coastguard Email..." },
  sent: { cls: "border-green-600 bg-green-50 text-green-900", Icon: CheckCircle2, iconCls: "text-[var(--green)]", text: "Sent Coastguard Email" },
  failed: { cls: "border-[var(--red)] bg-white text-[var(--red)]", Icon: XCircle, iconCls: "text-[var(--red)]", text: "Could not send to Coastguard" },
};
const IDLE = { cls: "border-[var(--red)] bg-[var(--red)] text-white", Icon: Mail, text: "Send to Coastguard Email" };

const CoastguardButton = ({ status, onSend }) => {
  const s = CG[status] || IDLE;
  return (
    <button type="button" onClick={onSend} disabled={status === "sending"} data-testid="coastguard-email-btn" data-status={status || "idle"}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border-2 px-3 text-sm font-extrabold uppercase tracking-wide [transition:transform_.1s] active:scale-[.98] disabled:cursor-wait ${s.cls}`}>
      <s.Icon className={`h-5 w-5 shrink-0 ${s.spin ? "animate-spin" : ""} ${s.iconCls || ""}`} />{s.text}
    </button>
  );
};

const Prompt = ({ name, onYes, onNo }) => (
  <div className="mbp-pop flex flex-wrap items-center gap-2 rounded-lg border-2 border-[var(--red)] bg-red-50 p-3" data-testid="coastguard-email-prompt">
    <Mail className="h-5 w-5 shrink-0 text-[var(--red)]" />
    <span className="min-w-0 flex-1 text-sm font-bold text-[var(--navy)]">Email this {name} to the coastguard in the background?</span>
    <div className="flex gap-2">
      <button type="button" onClick={onYes} className="min-h-[44px] rounded-md bg-[var(--red)] px-4 text-sm font-extrabold uppercase text-white" data-testid="coastguard-email-prompt-yes">Yes, send</button>
      <button type="button" onClick={onNo} className="min-h-[44px] rounded-md border-2 border-[var(--line)] bg-white px-4 text-sm font-bold text-[var(--navy)]" data-testid="coastguard-email-prompt-no">No</button>
    </div>
  </div>
);

const SHORE = { sending: ["Emailing your shore contact...", Loader2, "animate-spin text-[var(--muted)]"], sent: ["Shore contact emailed", CheckCircle2, "text-[var(--green)]"], failed: ["Could not email your shore contact, tap to retry", XCircle, "text-[var(--red)]"] };

const ShoreStatus = ({ status, onRetry }) => {
  const [text, Icon, cls] = SHORE[status];
  return (
    <button type="button" onClick={onRetry} disabled={status !== "failed"} data-testid="shore-distress-status" data-status={status}
      className="flex items-center gap-1.5 self-start text-xs font-bold text-[var(--navy)] disabled:cursor-default">
      <Icon className={`h-4 w-4 ${cls}`} />{text}
    </button>
  );
};

export const DistressEmailBar = ({ kind, online, hasCoastguard, status = {}, onSend, onNo, onRetryShore }) => {
  if (!online || (!hasCoastguard && !status.shore)) return null;
  const name = kind === "mayDay" ? "MAYDAY" : "PAN-PAN";
  return (
    <div className="flex flex-col gap-1.5" data-testid="distress-email-bar">
      {hasCoastguard && (status.prompt ? <Prompt name={name} onYes={onSend} onNo={onNo} /> : <CoastguardButton status={status.cg} onSend={onSend} />)}
      {status.shore && <ShoreStatus status={status.shore} onRetry={onRetryShore} />}
    </div>
  );
};
