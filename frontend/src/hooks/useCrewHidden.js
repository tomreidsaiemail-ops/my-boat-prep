import { useEffect, useState } from "react";

// Lists a crew member hides on a shared boat: kept on this device only, separate from the skipper's choices.
export default function useCrewHidden(boatId) {
  const key = `mbp_crew_hidden_${boatId}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const [hidden, setHidden] = useState(read);
  useEffect(() => setHidden(read()), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = (ids, visible) => setHidden((h) => {
    const next = visible ? h.filter((id) => !ids.includes(id)) : [...new Set([...h, ...ids])];
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  return [hidden, show];
}
