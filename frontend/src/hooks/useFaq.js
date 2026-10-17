import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const CACHE_KEY = "mbp_faq_cache";
export const FAQ_ID = "faq";
export const FAQ_LIST = { id: FAQ_ID, name: "FAQ", isShared: true };
export const faqLabel = (f) => `Q: ${f.question}  A: ${f.answer}`;

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch { return []; } };

export default function useFaq(online) {
  const [faq, setFaq] = useState(readCache);
  const store = useCallback((items) => { setFaq(items); localStorage.setItem(CACHE_KEY, JSON.stringify(items)); }, []);

  useEffect(() => {
    if (!online) return;
    api.get("/faq", { timeout: 10000 }).then(({ data }) => store(data.items)).catch(() => {});
  }, [online, store]);

  const save = useCallback(async (items) => {
    const { data } = await api.put("/admin/faq", { items }, { timeout: 10000 });
    store(data.items);
  }, [store]);

  return { faq, save };
}
