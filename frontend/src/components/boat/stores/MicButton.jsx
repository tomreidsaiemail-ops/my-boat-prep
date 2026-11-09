import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, Square } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useFeature } from "@/lib/features";

const LIMIT_MS = 60000;
const pickType = () => ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";

export const MicButton = (props) => (useFeature("speak") ? <MicControl {...props} /> : null);

// Record a short voice note; the AI turns it into text for onText.
const MicControl = ({ onText, disabled, params }) => {
  const [state, setState] = useState("idle");
  const rec = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => { clearTimeout(timer.current); rec.current?.stream?.getTracks().forEach((t) => t.stop()); }, []);
  const send = async (blob) => {
    setState("busy");
    const form = new FormData();
    form.append("file", blob, `note.${blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
    try {
      const { data } = await api.post("/ai/transcribe", form, { params, timeout: 60000 });
      if (data.text) onText(data.text); else toast.info("Didn't catch anything, please try again");
    } catch (err) { toast.error(apiError(err, "Couldn't turn that into text")); }
    setState("idle");
  };
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast.error("This browser can't record audio. Please type instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = pickType();
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); send(new Blob(chunks, { type: (r.mimeType || type || "audio/webm").split(";")[0] })); };
      r.stream = stream;
      rec.current = r;
      r.start();
      setState("rec");
      timer.current = setTimeout(() => r.state === "recording" && r.stop(), LIMIT_MS);
    } catch { toast.error("Microphone permission is needed to record"); }
  };
  const stop = () => { clearTimeout(timer.current); if (rec.current?.state === "recording") rec.current.stop(); };
  return (
    <button type="button" disabled={disabled || state === "busy"} onClick={state === "rec" ? stop : start} data-testid="stores-mic-btn" data-state={state}
      aria-label={state === "rec" ? "Stop recording" : "Record what was used"}
      className={`btn-ghost h-11 shrink-0 gap-1.5 px-3 text-sm ${state === "rec" ? "!border-[var(--red)] !text-[var(--red)]" : ""}`}>
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "rec" ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
      {state === "busy" ? "Listening..." : state === "rec" ? "Stop" : "Speak"}
    </button>
  );
};
