import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { parseCategories } from "@/lib/listCategories";

// The admin's list categories; the last copy is kept on the device for offline use.
const KEY = "mbp_list_categories";

export default function useListCategories(online) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } });
  useEffect(() => {
    if (!online) return;
    api.get("/list-categories").then(({ data }) => { setItems(data.items); localStorage.setItem(KEY, JSON.stringify(data.items)); }).catch(() => {});
  }, [online]);
  return useMemo(() => parseCategories(items), [items]);
}
