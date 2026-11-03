import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

export const TERMS_MAX = 4000;

// The skipper's own terms, added after the standard terms in every crew agreement.
export const BoatTermsField = ({ boat, value, online, onSaved }) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const save = async (t = text, saved = value) => {
    if (t.trim() === saved) return;
    if (!online) { toast.error("Go online to save your boat's terms"); return; }
    try { await api.put(`/boats/${boat.boat_id}/terms`, { terms: t }); toast.success("Boat terms saved"); onSaved(); }
    catch (e) { toast.error(apiError(e, "Couldn't save your boat's terms, please try again")); }
  };
  // Closing the crew window with Escape or X skips the blur, so unsaved terms are saved on the way out.
  const latest = useRef(null);
  latest.current = () => save(text, value);
  useEffect(() => () => latest.current(), []);
  return (
    <details className="rounded-md border-[1.5px] border-[var(--line)] p-3" data-testid="boat-terms-section">
      <summary className="cursor-pointer text-sm font-bold" data-testid="boat-terms-toggle">Boat Terms and Conditions{value ? "" : " (add your own)"}</summary>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Crew read and accept these when they join, after the standard terms, their role briefing and the Zone Map Walk Through. One term per line.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, TERMS_MAX))} onBlur={() => save()} rows={4} maxLength={TERMS_MAX}
        placeholder={"e.g. Shoes off below deck\nSkipper's cabin is private"}
        className="field-input mt-2 h-auto w-full resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="boat-terms-input" />
    </details>
  );
};
