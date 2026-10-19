import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const CACHE_KEY = "mbp_inventory_shared";
const EMPTY = { zone_map_v: null, area_defaults: [] };

const read = () => {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(CACHE_KEY)) }; } catch { return EMPTY; }
};

export default function useInventoryShared(online) {
  const [shared, setShared] = useState(read);

  useEffect(() => { localStorage.setItem(CACHE_KEY, JSON.stringify(shared)); }, [shared]);
  useEffect(() => {
    if (!online) return;
    api.get("/inventory/shared", { timeout: 10000 }).then(({ data }) => setShared(data)).catch(() => {});
  }, [online]);

  const update = useCallback((patch) => setShared((s) => ({ ...s, ...patch })), []);
  return { shared, update };
}
