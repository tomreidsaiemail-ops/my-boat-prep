import { useState } from "react";

const keyFor = (listId) => `mbp_order_${listId}`;

export default function useListOrdering(listId) {
  const [, bump] = useState(0);
  const on = localStorage.getItem(keyFor(listId)) === "1";
  const set = (v) => { localStorage.setItem(keyFor(listId), v ? "1" : "0"); bump((n) => n + 1); };
  return [on, set];
}
