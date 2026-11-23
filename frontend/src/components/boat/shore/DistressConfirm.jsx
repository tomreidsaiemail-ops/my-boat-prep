const TEXT = {
  mayDay: { text: "imminent danger MAYDAY event to Shore Contact.", tone: "border-[var(--red)] bg-red-50", btn: "bg-[var(--red)] hover:bg-red-800" },
  panPan: { text: "urgent PAN-PAN event to Shore Contact.", tone: "border-orange-500 bg-orange-50", btn: "bg-orange-500 hover:bg-orange-600" },
};
const SIZE = "text-[min(10.5px,2.4vw)] sm:text-xs";

// One line at the top of Mayday / Pan-Pan, read as "Confirm imminent danger MAYDAY event to Shore Contact. Ignore": the leading
// Confirm alerts the shore contact in the background while the call is made; Ignore, or leaving it unanswered, sends nothing.
export const DistressConfirm = ({ kind, onConfirm, onIgnore }) => {
  const t = TEXT[kind];
  if (!t) return null;
  return (
    <div className={`flex items-center gap-1 whitespace-nowrap rounded-md border-[1.5px] px-1.5 py-1 ${t.tone}`} role="group" aria-label={`Confirm ${t.text}`} data-testid="distress-confirm">
      <button type="button" onClick={onConfirm} className={`h-7 shrink-0 rounded-md px-1.5 font-extrabold uppercase text-white active:scale-95 [transition:background-color_.15s,transform_.1s] ${SIZE} ${t.btn}`} data-testid="distress-confirm-btn">Confirm</button>
      <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis font-extrabold text-[var(--navy)] ${SIZE}`} data-testid="distress-confirm-text">{t.text}</span>
      <button type="button" onClick={onIgnore} className={`h-7 shrink-0 rounded-md border-[1.5px] border-[var(--line)] bg-white px-1.5 font-extrabold text-[var(--navy)] hover:bg-slate-100 ${SIZE}`} data-testid="distress-ignore-btn">Ignore</button>
    </div>
  );
};
