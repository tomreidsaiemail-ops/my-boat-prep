import { useRef, useState } from "react";
import { api } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmail = (v) => EMAIL_RE.test((v || "").trim());

// Background Mayday / Pan-Pan email to the shore contact, once per session per kind. Never blocks the VHF call.
export default function useDistressEmail({ online, shore, build }) {
  const [st, setSt] = useState({});
  const done = useRef({});
  const send = (kind) => {
    setSt((s) => ({ ...s, [kind]: "sending" }));
    api.post("/distress-email", { ...build(kind), to: shore.trim() }, { timeout: 45000 })
      .then(() => setSt((s) => ({ ...s, [kind]: "sent" })))
      .catch(() => setSt((s) => ({ ...s, [kind]: "failed" })));
  };
  const opened = (kind) => {
    if (!online || !validEmail(shore) || done.current[kind]) return;
    done.current[kind] = true;
    send(kind);
  };
  return { state: st, opened, retryShore: send };
}
