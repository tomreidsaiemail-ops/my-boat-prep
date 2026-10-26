import { useEffect, useState } from "react";

const keyFor = (listId) => `mbp_fold_${listId}`;
const read = (listId) => { try { return JSON.parse(localStorage.getItem(keyFor(listId)) || "[]"); } catch { return []; } };

// Folded group parents for a list, remembered on this device only.
export default function useFolds(listId) {
  const [folded, setFolded] = useState(() => read(listId));
  useEffect(() => { setFolded(read(listId)); }, [listId]);
  const setFold = (id, fold) => setFolded((prev) => {
    const next = fold ? [...new Set([...prev, id])] : prev.filter((x) => x !== id);
    localStorage.setItem(keyFor(listId), JSON.stringify(next));
    return next;
  });
  const setFoldAll = (ids) => { localStorage.setItem(keyFor(listId), JSON.stringify(ids)); setFolded(ids); };
  return [folded, setFold, setFoldAll];
}
