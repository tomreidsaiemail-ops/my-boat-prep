import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Admin template lists starting with a prefix, e.g. "Admin - Help Panel - "; the last copy stays on the device for offline use.
export default function useAdminLists(prefix, online) {
  const key = `mbp_admin_lists_${prefix.toLowerCase().trim()}`;
  const [lists, setLists] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } });
  useEffect(() => {
    if (!online) return;
    api.get("/admin-lists", { params: { prefix } }).then(({ data }) => { setLists(data.lists); localStorage.setItem(key, JSON.stringify(data.lists)); }).catch(() => {});
  }, [online, prefix, key]);
  return lists;
}

export const stripPrefix = (name, prefix) => name.slice(prefix.trim().length).trim();
