import { useEffect, useState } from "react";
import { AlertTriangle, Waves } from "lucide-react";
import { api } from "@/lib/api";
import { TideWarning, localDay } from "@/components/boat/navigator/TideWarning";
import { useAuth } from "@/context/AuthContext";

const hm = (t) => new Date(t).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: false });
// CD heights are water above Chart Datum; MSL is plus or minus the mean (My settings > User Preferences).
export const tideHeight = (h, datum) => (datum === "MSL" ? `${h >= 0 ? "+" : ""}${h.toFixed(1)} m MSL` : `${Math.abs(h).toFixed(2)} m ${h < 0 ? "below" : "above"} ${datum || "CD"}`);
const dayName = (d) => new Date(`${d}T12:00`).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });

// High and low tides at a Route Planning place on one day, from the live tide service (never guessed).
export const TideNote = ({ place, pos, near, date, testId }) => {
  const [s, setS] = useState(null);
  const { user } = useAuth();
  const datum = user?.tide_datum || "CD";
  const show = !!user?.show_tides;
  const acked = user?.tide_ack_date === localDay();
  const name = (place || "").trim();
  useEffect(() => {
    setS(null);
    if (!show || !acked || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || (!name && !pos)) return undefined;
    let live = true;
    const t = setTimeout(() => {
      const start = new Date(`${date}T00:00`);
      const end = new Date(start.getTime() + 86400000);
      const params = { place: name, start: start.toISOString(), end: end.toISOString(), ...(pos ? { lat: pos.lat, lon: pos.lon } : {}), ...(!pos && near ? { near_lat: near.lat, near_lon: near.lon } : {}) };
      api.get("/marine/tides", { params }).then(({ data }) => live && setS(data)).catch(() => live && setS({ ok: false }));
    }, 900);
    return () => { live = false; clearTimeout(t); };
  }, [name, pos?.lat, pos?.lon, near?.lat, near?.lon, date, datum, show, acked]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  if (!acked) return <TideWarning testId={`${testId}-warning`} />;
  if (!s) return null;
  if (!s.ok) return (
    <p role="alert" className="-mt-1 flex gap-2 rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-[var(--red)]" data-testid={`${testId}-missing`}>
      <AlertTriangle className="h-4 w-4 shrink-0" /> Live tide data isn't available for {name || "this place"} on {dayName(date)}. Check the official tide tables before you sail.
    </p>
  );
  const st = s.station || {};
  return (
    <div className="-mt-1 flex gap-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-[var(--navy)]" data-testid={testId}>
      <Waves className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-bold">Tides - rough approximations: {name || "this place"}, {dayName(date)}</p>
        <p data-testid={`${testId}-times`}>{s.extremes.length ? s.extremes.map((x) => `${x.type === "high" ? "High" : "Low"} ${hm(x.time)} (${tideHeight(x.height, st.datum)})`).join(" · ") : "No high or low tide that day."}</p>
        <p className="text-[11px] text-[var(--muted)]">WorldTides{st.name ? ` · station ${st.name}` : ""} · this phone's time · {st.note || "heights from Mean Sea Level (MSL)"} · not for navigation, check official tide tables</p>
      </div>
    </div>
  );
};
