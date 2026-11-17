// "(today)", "(2 days)", "(1 day ago)" from the Departure date; "" when there is none.
export const daysToGo = (at) => {
  if (!at) return "";
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = Math.round((day(new Date(at)) - day(new Date())) / 86400000);
  if (Number.isNaN(n)) return "";
  if (n === 0) return "(today)";
  const word = `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;
  return n > 0 ? `(${word})` : `(${word} ago)`;
};

// A small pill that hops between Route Planning and Leaving Dock, with the days to departure after it.
export const HopBubble = ({ icon: Icon, label, onClick, departAt, testId }) => (
  <>
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-[var(--navy)] bg-white px-3 text-xs font-extrabold text-[var(--navy)] shadow-sm hover:bg-slate-100 active:scale-95 [transition:background-color_.15s,transform_.1s]" data-testid={`${testId}-btn`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
    {daysToGo(departAt) && <span className="text-sm font-bold text-[var(--muted)]" data-testid={`${testId}-days`}>{daysToGo(departAt)}</span>}
  </>
);
