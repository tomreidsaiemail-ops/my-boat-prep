import { CheckCircle2, ExternalLink, Loader2, Mail } from "lucide-react";

const fmt = (iso) => new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });

const SentStatus = ({ logSent }) => (
  <div className="flex items-start gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2.5 text-sm text-green-900" data-testid="log-email-status">
    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green)]" />
    <div className="min-w-0 flex-1">
      <div className="font-bold">Emailed to <span className="break-all">{logSent.to}</span>{logSent.shore && <span className="break-all"> &amp; {logSent.shore}</span>}</div>
      <div className="text-xs font-medium">{fmt(logSent.at)}</div>
    </div>
    <a href={logSent.pdf_url} target="_blank" rel="noreferrer" data-testid="log-email-view-pdf"
      className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--blue)] underline-offset-2 hover:underline">
      PDF <ExternalLink className="h-3.5 w-3.5" />
    </a>
  </div>
);

export const EmailLogPanel = ({ email, shore, onShoreChange, online, logSent, busy, onSend }) => (
  <section className="flex flex-col gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="email-log-panel">
    <div className="text-sm" data-testid="log-email-recipient">
      <span className="field-label">Sends to </span>
      {email.trim() ? <b className="break-all">{email.trim()}</b> : <span className="font-semibold text-[var(--muted)]">add your email at the top</span>}
    </div>
    <label className="flex flex-col gap-1" htmlFor="shore-email">
      <span className="field-label">Shore Contact: <span className="normal-case tracking-normal">(optional, also gets a copy)</span></span>
      <input id="shore-email" type="email" inputMode="email" value={shore} placeholder="shore.contact@email.com" onChange={(e) => onShoreChange(e.target.value)}
        className="field-input" data-testid="shore-email-input" />
    </label>
    <button type="button" onClick={onSend} disabled={!online || busy} className="btn-solid w-full text-sm disabled:cursor-not-allowed disabled:opacity-50" data-testid="log-email-send-btn">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      {busy ? "Sending..." : "Email Ship's Log"}
    </button>
    {!online && <p className="text-center text-xs font-bold text-[var(--muted)]" data-testid="log-email-offline-hint">Go online to email the log</p>}
    {logSent && <SentStatus logSent={logSent} />}
  </section>
);
