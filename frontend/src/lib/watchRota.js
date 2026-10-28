// Traditional ship's watches; the two dog watches make the rota rotate day to day.
export const WATCHES = [[0, 4, "Middle"], [4, 8, "Morning"], [8, 12, "Forenoon"], [12, 16, "Afternoon"], [16, 18, "First Dog"], [18, 20, "Last Dog"], [20, 24, "First"]];

const pad = (n) => String(n).padStart(2, "0");
export const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const nextHour = () => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return toLocal(d); };

export const buildRota = (startStr, hours, perWatch, count) => {
  const start = new Date(startStr);
  if (!count || Number.isNaN(start.getTime()) || !(hours > 0)) return [];
  const end = new Date(start.getTime() + hours * 3600e3);
  const slots = [];
  let t = start;
  while (t < end && slots.length < 400) {
    const h = t.getHours() + t.getMinutes() / 60;
    const [, wEnd, watch] = WATCHES.find(([a, b]) => h >= a && h < b);
    const next = new Date(t);
    next.setHours(wEnd, 0, 0, 0);
    const slotEnd = next < end ? next : end;
    const people = Array.from({ length: Math.min(perWatch, count) }, (_, k) => (slots.length * perWatch + k) % count);
    slots.push({ start: toLocal(t), end: toLocal(slotEnd), watch, people });
    t = slotEnd;
  }
  return slots;
};

export const dayLabel = (s) => new Date(s).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
export const timeOf = (s) => s.slice(11, 16);
