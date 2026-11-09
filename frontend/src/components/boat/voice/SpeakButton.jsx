import { useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SPEAK_EXAMPLES } from "@/lib/voiceCommand";
import { useFeature } from "@/lib/features";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// Mic button using the phone's own speech recognition. `plan(text)` returns { message, ...} to confirm or { error };
// `onConfirm(plan)` carries it out after the skipper taps OK.
export const SpeakButton = (props) => (useFeature("speak") ? <SpeakControl {...props} /> : null);

const SpeakControl = ({ plan, onConfirm, examples = SPEAK_EXAMPLES, className = "", label = "Speak", testId = "speak" }) => {
  const [state, setState] = useState(null);
  const rec = useRef(null);
  const listen = () => {
    const fake = window.__mbpFakeSpeech;
    if (typeof fake === "string") { setState({ heard: fake, ...plan(fake) }); return; }
    if (!Recognition) { setState({ error: "This phone's browser can't listen for speech. Try Chrome on Android or Safari on iPhone." }); return; }
    const r = new Recognition();
    r.lang = navigator.language || "en-NZ";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => { const heard = e.results[0][0].transcript.trim(); setState({ heard, ...plan(heard) }); };
    r.onerror = (e) => setState({ error: e.error === "not-allowed" ? "Please allow the microphone for My Boat Prep, then try again." : e.error === "no-speech" ? "I didn't hear anything." : "Speech recognition needs a signal on this phone." });
    r.onend = () => setState((s) => (s?.listening ? { error: "I didn't hear anything." } : s));
    rec.current = r;
    setState({ listening: true });
    try { r.start(); } catch { setState({ error: "Couldn't start the microphone, please try again." }); }
  };
  const close = () => { rec.current?.abort?.(); setState(null); };
  return (
    <>
      <button type="button" onClick={listen} className={className} title="Speak a command" aria-label={label} data-testid={`${testId}-btn`}>
        <Mic className="h-5 w-5 shrink-0" />{label && <span>{label}</span>}
      </button>
      <Dialog open={!!state} onOpenChange={(o) => !o && close()}>
        <DialogContent guard={false} className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid={`${testId}-dialog`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><Mic className="h-5 w-5" /> {state?.listening ? "Listening..." : state?.error ? "Let's try that again" : "Is this right?"}</DialogTitle>
            <DialogDescription className="text-left text-sm" data-testid={`${testId}-heard`}>
              {state?.listening ? "Say something like \"Remove milk from fridge\"." : state?.heard ? `I heard: "${state.heard}"` : ""}
            </DialogDescription>
          </DialogHeader>
          {state?.listening && <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--navy)]" />}
          {state?.message && <p className="rounded-md bg-sky-50 p-3 text-base font-bold text-[var(--navy)]" data-testid={`${testId}-confirm-text`}>{state.message}</p>}
          {state?.error && (
            <div className="flex flex-col gap-2 text-sm" data-testid={`${testId}-error`}>
              <p className="rounded-md bg-red-50 p-3 font-bold text-[var(--red)]">{state.error}</p>
              <p className="text-[var(--muted)]">Try saying:</p>
              <ul className="flex flex-col gap-1">{examples.map((x) => <li key={x} className="font-semibold">"{x}"</li>)}</ul>
            </div>
          )}
          {!state?.listening && (
            <DialogFooter className="flex-row gap-2">
              <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={state?.message ? close : listen} data-testid={`${testId}-retry-btn`}>{state?.message ? "Cancel" : "Try again"}</button>
              {state?.message
                ? <button type="button" className="btn-solid h-12 flex-1 justify-center" onClick={() => { const p = state; setState(null); onConfirm(p); }} data-testid={`${testId}-ok-btn`}>OK</button>
                : <button type="button" className="btn-solid h-12 flex-1 justify-center" onClick={close} data-testid={`${testId}-close-btn`}>Close</button>}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
