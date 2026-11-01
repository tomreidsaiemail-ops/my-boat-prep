const RAD = Math.PI / 180;

// Today's sunset (NOAA approximation) for a position, east longitude positive; null in polar day or night.
export const sunsetAt = (lat, lon, date = new Date()) => {
  const y = date.getFullYear();
  const midnight = Date.UTC(y, date.getMonth(), date.getDate());
  const day = Math.round((midnight - Date.UTC(y, 0, 0)) / 864e5);
  const g = ((2 * Math.PI) / 365) * (day - 0.5);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(90.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosH > 1 || cosH < -1) return null;
  const minutes = 720 - 4 * (lon - Math.acos(cosH) / RAD) - eqt;
  const at = new Date(midnight + minutes * 60000);
  // Keep it on the local calendar day (far east/west longitudes can roll a day).
  const shift = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()) - new Date(y, date.getMonth(), date.getDate())) / 864e5);
  return shift ? new Date(at.getTime() - shift * 864e5) : at;
};

export const localDayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Sunset where the boat is, or 6pm when there's no GPS fix.
export const sundownerTime = (gps, now = new Date()) => {
  const at = gps?.status === "ok" && Number.isFinite(gps.lat) ? sunsetAt(gps.lat, gps.lon, now) : null;
  return at || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0);
};
