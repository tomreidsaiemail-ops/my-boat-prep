import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const CACHE_KEY = "mbp_templates_cache";
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; } };

export default function useTemplates(online) {
  const [templates, setTemplates] = useState(readCache);

  useEffect(() => { localStorage.setItem(CACHE_KEY, JSON.stringify(templates)); }, [templates]);

  useEffect(() => {
    if (!online) return;
    api.get("/templates", { timeout: 10000 }).then(({ data }) => setTemplates(data.templates)).catch(() => {});
  }, [online]);

  const publish = useCallback(async (listId, items) => {
    const { data } = await api.put(`/admin/templates/${listId}`, { items }, { timeout: 15000 });
    setTemplates((t) => ({ ...t, [listId]: { items: data.items, updated_at: data.updated_at } }));
    return data;
  }, []);

  return { templates, publish };
}
