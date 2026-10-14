import { ArrowLeft, Printer } from "lucide-react";

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
        <span className={item.checked ? "line-through text-neutral-500" : ""}>{labelFor(item)}</span>
      </div>
    ))}
    <div className="print-sign">Checked by (Skipper): ____________________________ &nbsp; Time: __________</div>
  </section>
);

export const PrintView = ({ lists, data, labelFor, boat, verboseDate, title, onBack }) => (
  <div className="mx-auto max-w-3xl p-4 sm:p-8" data-testid="print-view">
    <div className="no-print mb-6 flex flex-wrap items-center gap-2 rounded-lg border-[1.5px] border-amber-300 bg-amber-50 p-3">
      <button type="button" className="btn-solid px-5" onClick={() => window.print()} data-testid="print-save-pdf-btn"><Printer className="h-4 w-4" /> Save PDF</button>
      <button type="button" className="btn-ghost px-5" onClick={onBack} data-testid="print-back-btn"><ArrowLeft className="h-4 w-4" /> Back to Edit App</button>
      <span className="ml-auto text-xs font-bold text-amber-900" data-testid="print-view-title">{title} · lamination layout</span>
    </div>
    {lists.map((list, i) => (
      <ListPage key={list.id} list={list} index={i} items={data[list.id] || []} labelFor={labelFor} boat={boat} verboseDate={verboseDate} />
    ))}
  </div>
);
