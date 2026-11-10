import { useRef, useState } from "react";
import { api } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validEmail = (v) => EMAIL_RE.test((v || "").trim());

// Background Mayday / Pan-Pan emails. Never throws, never blocks the VHF call.
export default function useDistressEmail({ online, coastguard, shore, build }) {
  const [st, setSt] = useState({});
  const shoreDone = useRef({});
  const patch = (kind, p) => setSt((s) => ({ ...s, [kind]: { ...s[kind], ...p } }));
  const send = (kind, to, key) => {
    patch(kind, { [key]: "sending" });
    api.post("/distress-email", { ...build(kind), to: to.trim(), target: key === "cg" ? "coastguard" : "shore" }, { timeout: 45000 })
      .then(() => patch(kind, { [key]: "sent" }))
      .catch(() => patch(kind, { [key]: "failed" }));
  };
  const opened = (kind) => {
    if (!online) return;
    if (validEmail(shore) && !shoreDone.current[kind]) { shoreDone.current[kind] = true; send(kind, shore, "shore"); }
    const cg = st[kind]?.cg;
    if (validEmail(coastguard) && cg !== "sent" && cg !== "sending") patch(kind, { prompt: true });
  };
  return {
    state: st,
    opened,
    sendCoastguard: (kind) => { patch(kind, { prompt: false }); send(kind, coastguard, "cg"); },
    retryShore: (kind) => send(kind, shore, "shore"),
    dismiss: (kind) => patch(kind, { prompt: false }),
  };
}
