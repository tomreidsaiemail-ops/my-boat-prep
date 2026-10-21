import { useEffect, useState } from "react";

const keyFor = (listId) => `mbp_order_${listId}`;

export default function useListOrdering(listId) {
  const [on, setOn] = useState(() => localStorage.getItem(keyFor(listId)) === "1");
  useEffect(() => { setOn(localStorage.getItem(keyFor(listId)) === "1"); }, [listId]);
  const set = (v) => { localStorage.setItem(keyFor(listId), v ? "1" : "0"); setOn(v); };
  return [on, set];
}
