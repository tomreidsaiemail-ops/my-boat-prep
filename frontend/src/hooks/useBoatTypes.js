import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// The admin's boat types ("Admin - Boat types"); the last copy is kept on the device for offline use.
const KEY = "mbp_boat_types";
export const DEFAULT_BOAT_TYPES = ["Yacht - Sloop", "Yacht - Sloop, Solent Rigged", "Yacht - Cutter Rigged", "Yacht - Ketch", "Yacht - Yawl", "Yacht - Schooner",
  "Catamaran", "Trimaran", "Trawler", "Motor Cruiser", "Launch", "Runabout", "RIB"];
let fetched = false;

export default function useBoatTypes() {
  const [types, setTypes] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)) || DEFAULT_BOAT_TYPES; } catch { return DEFAULT_BOAT_TYPES; } });
  useEffect(() => {
    if (fetched) return;
    api.get("/boat-types").then(({ data }) => {
      fetched = true;
      setTypes(data.types);
      localStorage.setItem(KEY, JSON.stringify(data.types));
    }).catch(() => {});
  }, []);
  return types;
}
