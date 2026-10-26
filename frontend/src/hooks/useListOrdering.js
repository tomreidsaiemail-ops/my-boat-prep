import { useState } from "react";

// A per-list on/off setting kept on this device only.
export const useListSetting = (prefix, listId, fallback = false) => {
  const [, bump] = useState(0);
  const key = `${prefix}_${listId}`;
  const saved = localStorage.getItem(key);
  const on = saved === null ? fallback : saved === "1";
  const set = (v) => { localStorage.setItem(key, v ? "1" : "0"); bump((n) => n + 1); };
  return [on, set];
};

export default function useListOrdering(listId) {
  return useListSetting("mbp_order", listId);
}
