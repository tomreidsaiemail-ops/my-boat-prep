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

// crew: light blue crew-themed hops; prep: a crew member's Crew Prep (light red), done once they've ticked it all (green).
const TONES = {
  navy: "border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-slate-100",
  crew: "border-sky-400 bg-sky-100 text-sky-900 hover:bg-sky-200",
  prep: "border-red-300 bg-red-50 text-red-900 hover:bg-red-100",
  done: "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
};

// A small pill that hops between Route Planning and Leaving Dock, with the days to departure after it.
export const HopBubble = ({ icon: Icon, label, onClick, departAt, testId, tone = "navy" }) => (
  <>
    <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-full border-2 px-3 text-xs font-extrabold shadow-sm active:scale-95 [transition:background-color_.15s,transform_.1s] ${TONES[tone]}`} data-testid={`${testId}-btn`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
    {daysToGo(departAt) && <span className="text-sm font-bold text-[var(--muted)]" data-testid={`${testId}-days`}>{daysToGo(departAt)}</span>}
  </>
);
