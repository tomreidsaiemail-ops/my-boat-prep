import { List } from "lucide-react";

export const BRIEFING_MAX = 1000;
const MARK = /^\s*(?:[•\-*–·]|\d+[.)])\s*/;
// Every line becomes a tidy "• " point; blank lines go, and existing dashes, stars or numbers are replaced.
export const bulletise = (text) => text.split(/\r?\n/).map((l) => l.replace(MARK, "").trim()).filter(Boolean).map((l) => `• ${l}`).join("\n").slice(0, BRIEFING_MAX);

export const BulletButton = ({ text, onChange, testId }) => (
  <button type="button" className="btn-ghost h-9 min-h-0 gap-1.5 self-start px-3 text-xs font-bold" disabled={!text.trim()} onClick={() => onChange(bulletise(text))} data-testid={testId}>
    <List className="h-3.5 w-3.5" /> Bullet points
  </button>
);

// Shown when editing a role in the Crew Roles list; goes in the invite email and the crew agreement.
export const RoleBriefingField = ({ value, onChange }) => (
  <label className="flex flex-col gap-1 text-sm font-bold">Role Briefing
    <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, BRIEFING_MAX))} rows={7} maxLength={BRIEFING_MAX}
      placeholder="e.g. One hand for the boat at all times"
      className="field-input !h-auto min-h-[8rem] resize-y py-2 font-normal leading-snug" data-testid="edit-item-briefing-input" />
    <BulletButton text={value} onChange={onChange} testId="edit-item-briefing-bullets-btn" />
    <span className="text-xs font-normal text-[var(--muted)]">Sent in the crew invite email, and shown in the Boat Terms and Conditions Agreement crew accept when they join.</span>
  </label>
);
