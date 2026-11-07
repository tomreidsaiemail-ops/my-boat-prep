const UNITS = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];

export const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!iso || Number.isNaN(s)) return "";
  const hit = UNITS.find(([, n]) => s >= n);
  if (!hit) return "just now";
  const v = Math.floor(s / hit[1]);
  return `${v} ${hit[0]}${v === 1 ? "" : "s"} ago`;
};

// Date and time in the phone's own time zone, e.g. "7 Nov 2026, 2:05 pm".
export const localWhen = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
