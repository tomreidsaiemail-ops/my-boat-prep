import { ArrowLeft, CheckCircle2, Flag, Loader2, Lock, Mail, Printer } from "lucide-react";

const Meta = ({ boat, verboseDate }) => (
  <div className="print-meta">
    <div>VESSEL: <b data-testid="print-vessel">{boat.vessel}</b></div>
    <div>SKIPPER: <b data-testid="print-skipper">{boat.skipper}</b></div>
    <div>CALLSIGN: <b data-testid="print-callsign">{boat.callsign}</b></div>
    <div>DATE: <b data-testid="print-date">{verboseDate}</b></div>
  </div>
);

const ListPage = ({ list, items, labelFor, boat, verboseDate, index }) => (
  <section className={`print-page ${index > 0 ? "page-break" : ""}`} data-testid={`print-list-${list.id}`}>
    <div className="print-head">
      <h2 className="print-title">{list.name}</h2>
      <span className="print-brand">My Boat Prep</span>
    </div>
    <Meta boat={boat} verboseDate={verboseDate} />
    {items.map((item) => (
      <div key={item.id} className="print-row">
        <span className={`print-box ${item.checked ? "checked" : ""}`} />
        <span className={item.flagged ? "flex items-start gap-1.5 font-bold text-red-700" : item.checked ? "line-through text-neutral-500" : ""}>
          {item.flagged && <Flag className="mt-1 h-4 w-4 shrink-0 fill-current" />}{labelFor(item)}
        </span>
      </div>
    ))}
  </section>
);

export const PrintView = ({ lists, data, labelFor, boat, verboseDate, title, onBack, onEmail, online, sending, emailed, locked }) => (
  <div className="mx-auto max-w-3xl p-4 sm:p-8" data-testid="print-view">
    <div className="no-print mb-6 grid grid-cols-3 gap-2 rounded-lg border-[1.5px] border-amber-300 bg-amber-50 p-3">
      <button type="button" className="btn-solid" onClick={() => window.print()} data-testid="print-save-pdf-btn"><Printer className="h-4 w-4" /> Save PDF</button>
      <button type="button" className="btn-solid disabled:cursor-not-allowed disabled:opacity-50" onClick={onEmail} disabled={!online || sending}
        title={online ? "Email this PDF" : "Go online to email"} data-testid="print-email-pdf-btn">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : emailed ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : locked ? <Lock className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
        {sending ? "Sending..." : emailed ? "Emailed" : "Email PDF"}
      </button>
      <button type="button" className="btn-ghost" onClick={onBack} data-testid="print-back-btn"><ArrowLeft className="h-4 w-4" /> Back to Edit App</button>
      <span className="col-span-3 text-right text-xs font-bold text-amber-900" data-testid="print-view-title">{title} · lamination layout</span>
    </div>
    {lists.map((list, i) => (
      <ListPage key={list.id} list={list} index={i} items={data[list.id] || []} labelFor={labelFor} boat={boat} verboseDate={verboseDate} />
    ))}
  </div>
);
