import { useEffect, useState } from "react";

const dm = (val, pos, neg) => {
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(2).padStart(5, "0");
  return `${deg}° ${min}' ${val >= 0 ? pos : neg}`;
};

export const formatPosition = (lat, lon) => `Lat ${dm(lat, "N", "S")} / Long ${dm(lon, "E", "W")}`;

export default function useGps() {
  const [gps, setGps] = useState({ status: "locating", text: "Locating position..." });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGps({ status: "unavailable", text: "Position unavailable" });
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setGps({ status: "ok", text: formatPosition(p.coords.latitude, p.coords.longitude) }),
      () => setGps({ status: "unavailable", text: "Position unavailable" }),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return gps;
}
