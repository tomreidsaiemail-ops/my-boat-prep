import { useEffect, useState } from "react";

const dm = (val, pos, neg) => {
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(2).padStart(5, "0");
  return `${deg}° ${min}' ${val >= 0 ? pos : neg}`;
};

export const formatPosition = (lat, lon) => `Lat ${dm(lat, "N", "S")} / Long ${dm(lon, "E", "W")}`;

const LAST_KEY = "mbp_last_fix";
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY)) || null; } catch { return null; } };

// Live fix, else the last known fix with its time, else UNKNOWN.
export const distressPosition = (gps) => {
  if (gps.status === "ok") return gps.text;
  if (!gps.last) return "UNKNOWN";
  const at = new Date(gps.last.at).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${gps.last.text} (last known ${at})`;
};

export default function useGps() {
  const [gps, setGps] = useState(() => ({ status: "locating", text: "Locating position...", last: readLast() }));

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGps((g) => ({ status: "unavailable", text: "Position unavailable", last: g.last }));
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const text = formatPosition(p.coords.latitude, p.coords.longitude);
        const last = { text, at: Date.now() };
        localStorage.setItem(LAST_KEY, JSON.stringify(last));
        setGps({ status: "ok", text, lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, last });
      },
      () => setGps((g) => ({ status: "unavailable", text: "Position unavailable", last: g.last })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return gps;
}
