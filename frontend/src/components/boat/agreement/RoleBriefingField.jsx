export const BRIEFING_MAX = 1000;

// Shown when editing a role in the Crew Roles list; goes in the invite email and the crew agreement.
export const RoleBriefingField = ({ value, onChange }) => (
  <label className="flex flex-col gap-1 text-sm font-bold">Role Briefing
    <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, BRIEFING_MAX))} rows={4} maxLength={BRIEFING_MAX}
      placeholder="e.g. One hand for the boat at all times"
      className="field-input h-auto resize-y py-2 font-normal leading-snug" data-testid="edit-item-briefing-input" />
    <span className="text-xs font-normal text-[var(--muted)]">Sent in the crew invite email, and shown in the Boat Terms and Conditions Agreement crew accept when they join.</span>
  </label>
);
