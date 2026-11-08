// Charter periods read like "Friday 1/1/2027 to Thursday 7/1/2027 inclusive".
export const fmtDay = (iso) => {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y) return "";
  const dt = new Date(y, m - 1, d);
  return `${dt.toLocaleDateString(undefined, { weekday: "long" })} ${dt.toLocaleDateString()}`;
};
export const fmtPeriod = (c) => `${fmtDay(c.start)} to ${fmtDay(c.end)} inclusive`;

export const STATUS = {
  registered: { text: "Registered", cls: "bg-slate-100 text-slate-800" },
  handed_over: { text: "Handed over", cls: "bg-amber-100 text-amber-900" },
  returned: { text: "Returned", cls: "bg-green-100 text-green-900" },
  deleted: { text: "Copy deleted", cls: "bg-slate-200 text-slate-700" },
};

const today = () => new Date().toLocaleDateString("en-CA");
export const isOverdue = (c) => !!c?.end && today() > c.end;
