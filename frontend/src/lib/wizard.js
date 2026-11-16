// Model Vessel walkthroughs: every "Admin - Model Vessel - <title>" list is one wizard.
export const WIZARD_PREFIX = "Admin - Model Vessel";
export const BASIC = "basic introduction walkthrough";
const PREFIX_RE = /^\s*admin\s*-\s*model vessel\s*-\s*/i;
const FINISH = /^\s*(--|\$\$|%%)/;

export const isWizardName = (name = "") => PREFIX_RE.test(name);
export const wizardTitle = (name = "") => name.replace(PREFIX_RE, "").replace(/\s+/g, " ").trim();
export const wizardKey = (name = "") => wizardTitle(name).toLowerCase();

const kindOf = (l) => (/^\s*%%/.test(l) ? "para" : /^\s*\$\$\$/.test(l) ? "link" : /^\s*\$\$/.test(l) ? "idea" : /^\s*---/.test(l) ? "tick" : "head");
// Finish panel lines: "--" bold, "---" ticked, "$$" an idea, "$$$" a link that opens another walkthrough. Every other line is a step.
// Every step ends the same way: ".  Press Next". Only the last 20 characters are looked at: any "Press Next" there
// (any case) and whatever follows it is dropped, then a full stop is added if the line doesn't already end with one.
export const withNext = (l) => {
  let t = l.trim();
  const at = t.slice(-20).search(/press next/i);
  if (at >= 0) t = t.slice(0, Math.max(0, t.length - 20) + at);
  t = t.replace(/[\s,;:]+$/, "");
  return `${t}${/[.!?]$/.test(t) ? "" : "."}  Press Next`;
};
const isStep = (l) => l.trim() && !FINISH.test(l);
export const parseWizard = (lines = []) => ({
  steps: lines.filter(isStep).map(withNext),
  raw: lines.filter(isStep),
  finishRaw: lines.filter((l) => FINISH.test(l)).map((l) => l.trim()),
  finish: lines.filter((l) => FINISH.test(l)).map((l) => ({ kind: kindOf(l), text: l.replace(/^\s*(-+|\$+|%+)\s*/, "") })).filter((f) => f.text),
});
// "$$$ Crew Registration and Invites..." -> that walkthrough, if it exists.
export const linkedWizard = (wizards, text) => wizards.find((w) => w.key === text.replace(/\.+\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase());

// Basic Introduction first, then A-Z; only lists with steps.
export const wizardsFrom = (lists = []) => lists.filter((l) => isWizardName(l.name) && wizardTitle(l.name))
  .map((l) => ({ key: wizardKey(l.name), title: wizardTitle(l.name), lines: (l.items || []).map((i) => i.label) }))
  .filter((w) => parseWizard(w.lines).steps.length)
  .sort((a, b) => (a.key === BASIC ? -1 : b.key === BASIC ? 1 : a.title.localeCompare(b.title)));
