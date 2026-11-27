// Ship's Log entry times: when the entry was made (fixed) and when the event happened (default the same; up to a month earlier or 5 days later).
export const LOG_PROMPT = "Record any noteworthy event, or observation";
const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString();

// Older entries carry their time in `ts` or in their id (Date.now(), or Date.now() * 1000 + a random 3 digits from the server).
export const loggedAt = (i) => {
  if (!i || i.folder || i.dynamic) return "";
  if (i.logged_at || i.ts) return i.logged_at || i.ts;
  const n = Number(i.id);
  const ms = n > 1e15 ? Math.floor(n / 1000) : n;
  return ms > 1e12 && ms < 1e13 ? iso(ms) : "";
};
export const eventAt = (i) => i?.event_at || loggedAt(i);
export const stampLog = (now = Date.now()) => ({ logged_at: iso(now), event_at: iso(now) });

export const fmtLog = (s) => new Date(s).toLocaleString("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const logWhen = (i) => {
  const l = loggedAt(i);
  if (!l) return "";
  const e = eventAt(i);
  return Math.abs(new Date(e) - new Date(l)) < 60000 ? `Event: ${fmtLog(e)}` : `Event: ${fmtLog(e)} · Entry made: ${fmtLog(l)}`;
};

const pad = (n) => String(n).padStart(2, "0");
export const toLocalInput = (s) => { const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// paper: a Batch Magic Scan Paper Log, whose event can be any time in the past.
export const eventRange = (logged, paper = false) => {
  const t = new Date(logged);
  const min = new Date(t);
  min.setMonth(min.getMonth() - 1);
  return [paper ? null : min, new Date(t.getTime() + 5 * DAY)];
};
// The event time typed in the edit window (datetime-local): an error message, or "".
export const eventError = (logged, local, paper = false) => {
  const d = new Date(local);
  if (!local || Number.isNaN(d.getTime())) return "Pick the date and time of the event";
  const [min, max] = eventRange(logged, paper);
  if (min && d < new Date(min.getTime() - 60000)) return `The event can be no earlier than ${fmtLog(min)}, a month before the entry was made`;
  if (d > max) return `The event can be no later than ${fmtLog(max)}, 5 days after the entry was made`;
  return "";
};
