import { CircleDot, WifiOff } from "lucide-react";

const ago = (min) => (min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ${min % 60} min ago`);

// online / offline (missed the hourly check-in) / waiting for a first position / not tracking.
export const ShoreStatus = ({ status, testId }) => {
  const s = status?.state || "off";
  const look = {
    online: ["bg-emerald-600 text-white", <CircleDot key="i" className="h-4 w-4" />, `Online · last position ${ago(status.minutes || 0)}`],
    offline: ["bg-[var(--red)] text-white", <WifiOff key="i" className="h-4 w-4" />, `Offline · missed the hourly check-in · last heard ${ago(status.minutes || 0)}`],
    waiting: ["bg-amber-500 text-white", <CircleDot key="i" className="h-4 w-4" />, "Tracking on · waiting for the first position from a phone aboard"],
    off: ["bg-slate-300 text-slate-800", <CircleDot key="i" className="h-4 w-4" />, "Not sharing position right now"],
  }[s];
  return (
    <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${look[0]}`} data-testid={testId} data-state={s}>
      {look[1]} {look[2]}
    </p>
  );
};
