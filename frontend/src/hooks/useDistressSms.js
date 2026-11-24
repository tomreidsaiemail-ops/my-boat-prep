import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const POLL_MS = 5000;
const POLL_TIMES = 40;

// Background Mayday / Pan-Pan text to every shore contact with a phone, once confirmed (once per session per kind).
// Never blocks the VHF call; state[kind] becomes "delivered" for the small SMS tick.
export default function useDistressSms({ online, owner, boatId, build }) {
  const [phones, setPhones] = useState(0);
  const [st, setSt] = useState({});
  const done = useRef({});
  const timers = useRef([]);
  useEffect(() => {
    if (!online || !boatId) return;
    api.get("/distress-sms/phones", { params: { owner_id: owner, boat_id: boatId } }).then(({ data }) => setPhones(data.phones)).catch(() => {});
  }, [online, owner, boatId]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const poll = (kind, id, n = 0) => {
    if (n >= POLL_TIMES) return;
    timers.current.push(setTimeout(() => api.get(`/distress-sms/${id}`).then(({ data }) => {
      if (data.status === "sending") poll(kind, id, n + 1);
      else setSt((s) => ({ ...s, [kind]: data }));
    }).catch(() => poll(kind, id, n + 1)), POLL_MS));
  };
  const canSend = (kind) => online && phones > 0 && !done.current[kind];
  const opened = (kind) => {
    if (!canSend(kind)) return;
    done.current[kind] = true;
    const { vessel, callsign, position, lines } = build(kind);
    api.post("/distress-sms", { owner_id: owner, boat_id: boatId, kind, vessel, callsign, position, lines }, { timeout: 30000 })
      .then(({ data }) => data.sms_id && poll(kind, data.sms_id))
      .catch(() => {});
  };
  return { state: st, canSend, opened };
}
