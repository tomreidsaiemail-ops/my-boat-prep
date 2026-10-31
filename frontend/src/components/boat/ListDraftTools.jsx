import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { api, apiError } from "@/lib/api";

// Repeats are dropped within a numbered group only, so a meal plan can list Salt under several meals.
export const toLines = (text) => {
  const out = [];
  let seen = new Set();
  const heads = new Set();
  text.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
    const key = l.toLowerCase();
    if (/^\d+[.)]\s/.test(l)) {
      if (heads.has(key)) return;
      heads.add(key);
      seen = new Set();
    } else if (seen.has(key)) return;
    seen.add(key);
    out.push(l);
  });
  return out;
};
export const DESCRIPTION_MAX = 4000;
// Template placeholders like <Your Celebrities Favorite TV> that are still in the text.
const PLACEHOLDER = /<[^<>\s](?:[^<>\n]*[^<>\s])?>/g;
export const unfilledPlaceholders = (text) => [...new Set(String(text).match(PLACEHOLDER) || [])];
export const fillPlaceholders = (text, fills) => String(text).replace(PLACEHOLDER, (m) => (fills[m]?.trim() ? fills[m] : m));

// One small box per <placeholder> in the description; what's typed replaces it in the text.
export const PlaceholderBoxes = ({ text, fills, onChange, testId = "create-list" }) => {
  const keys = unfilledPlaceholders(text);
  if (!keys.length) return null;
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-3" data-testid={`${testId}-placeholders`}>
      <legend className="px-1 text-sm font-bold">Fill in the blanks</legend>
      {keys.map((k, i) => {
        const label = k.slice(1, -1);
        const done = !!fills[k]?.trim();
        return (
          <label key={k} className="flex flex-col gap-1 text-xs font-bold text-[var(--navy)]">
            <span className="flex items-center gap-1">{done && <Check className="h-3.5 w-3.5 text-emerald-700" data-testid={`${testId}-placeholder-done-${i}`} />}{label}</span>
            <input value={fills[k] || ""} onChange={(e) => onChange(k, e.target.value)} maxLength={200} placeholder={`Type ${label}`} aria-label={label}
              className={`field-input h-10 font-normal ${done ? "!border-emerald-600" : ""}`} data-testid={`${testId}-placeholder-input-${i}`} />
          </label>
        );
      })}
    </fieldset>
  );
};

export const ListDescriptionField = ({ value, onChange, testId = "create-list" }) => (
  <label className="flex flex-col gap-1 text-sm font-bold">List description
    <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, DESCRIPTION_MAX))} maxLength={DESCRIPTION_MAX} rows={3}
      placeholder="Describe what this list is for, e.g. Checks before a night passage, grouped by area of the boat"
      className="field-input min-h-[80px] py-2 font-normal leading-relaxed" data-testid={`${testId}-description-input`} />
    <span className="self-end text-xs font-normal text-[var(--muted)]" data-testid={`${testId}-description-count`}>{value.length}/{DESCRIPTION_MAX}</span>
  </label>
);

export const AiDraftButton = ({ name, description, online = true, hasText, onDraft, testId = "create-list" }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [description]);
  const draft = async () => {
    if (!description.trim()) { setNote("Describe the list in List Description first, then Magic List Generation can create the items"); return; }
    const blanks = unfilledPlaceholders(description);
    if (blanks.length) { setNote(`Please enter ${blanks.join(", ")} in List description first. Replace each part in < > with your own words.`); return; }
    setBusy(true);
    setNote("");
    try {
      const { data } = await api.post("/ai/list-draft", { name: name.trim(), description: description.trim() }, { timeout: 90000 });
      onDraft(data.lines.join("\n"));
      setNote(`Items ready, edit them before you confirm. ${data.drafts_left} Magic generations left (free today + bought).`);
    } catch (e) { setNote(apiError(e, "Magic List Generation couldn't create that list right now. Please try again.")); }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={draft} disabled={busy || !online} className="btn-ghost justify-center gap-2 text-center" data-testid={`${testId}-ai-draft-btn`}>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Sparkles className="h-4 w-4 shrink-0" />}
        {busy ? "Magic List Generation is working..." : hasText ? "Replace items using Magic List Generation" : "Create items using Magic List Generation"}
      </button>
      {!online && <p className="text-xs text-[var(--muted)]" data-testid={`${testId}-ai-offline`}>Magic List Generation needs a signal.</p>}
      {note && <p role={note.startsWith("Please enter") ? "alert" : undefined} className={`text-xs font-semibold ${note.startsWith("Please enter") ? "rounded-md bg-red-50 px-2 py-1.5 text-[var(--red)]" : ""}`} data-testid={`${testId}-ai-note`}>{note}</p>}
    </div>
  );
};

export const AutoIndentToggle = ({ checked, onChange, testId = "create-list" }) => (
  <label className="flex items-start gap-2 text-sm font-semibold">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${testId}-auto-indent-checkbox`} />
    Make numbered lines into group headings and indent the items below them
  </label>
);
