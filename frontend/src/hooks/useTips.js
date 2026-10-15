import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const CACHE_KEY = "mbp_tips_cache";
export const TIPS_ID = "skippersTips";
export const TIPS_LIST = { id: TIPS_ID, name: "Skipper's Tips", isShared: true };

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch { return []; } };

export default function useTips(online) {
  const [tips, setTips] = useState(readCache);
  const store = useCallback((items) => { setTips(items); localStorage.setItem(CACHE_KEY, JSON.stringify(items)); }, []);

  useEffect(() => {
    if (!online) return;
    api.get("/tips", { timeout: 10000 }).then(({ data }) => store(data.items)).catch(() => {});
  }, [online, store]);

  const save = useCallback(async (items) => {
    const { data } = await api.put("/admin/tips", { items }, { timeout: 10000 });
    store(data.items);
  }, [store]);

  return { tips, save };
}
