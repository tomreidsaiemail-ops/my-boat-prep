// Model Vessel walkthroughs: every "Admin - Model Vessel - <title>" list is one wizard.
export const WIZARD_PREFIX = "Admin - Model Vessel";
export const BASIC = "basic introduction walkthrough";
const PREFIX_RE = /^\s*admin\s*-\s*model vessel\s*-\s*/i;
const FINISH = /^\s*(--|\$\$)/;

export const isWizardName = (name = "") => PREFIX_RE.test(name);
export const wizardTitle = (name = "") => name.replace(PREFIX_RE, "").replace(/\s+/g, " ").trim();
export const wizardKey = (name = "") => wizardTitle(name).toLowerCase();

const kindOf = (l) => (/^\s*\$\$\$/.test(l) ? "link" : /^\s*\$\$/.test(l) ? "idea" : /^\s*---/.test(l) ? "tick" : "head");
// Finish panel lines: "--" bold, "---" ticked, "$$" an idea, "$$$" a link that opens another walkthrough. Every other line is a step.
// Steps that don't already end with "Press Next" (e.g. "... Press Next." or "Press Next to finish.") get it added.
const withNext = (l) => (/press next/i.test(l.trim().slice(-25)) ? l.trim() : `${l.trim()}  Press Next`);
const isStep = (l) => l.trim() && !FINISH.test(l);
export const parseWizard = (lines = []) => ({
  steps: lines.filter(isStep).map(withNext),
  raw: lines.filter(isStep),
  finish: lines.filter((l) => FINISH.test(l)).map((l) => ({ kind: kindOf(l), text: l.replace(/^\s*(-+|\$+)\s*/, "") })).filter((f) => f.text),
});
// "$$$ Crew Registration and Invites..." -> that walkthrough, if it exists.
export const linkedWizard = (wizards, text) => wizards.find((w) => w.key === text.replace(/\.+\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase());

// Basic Introduction first, then A-Z; only lists with steps.
export const wizardsFrom = (lists = []) => lists.filter((l) => isWizardName(l.name) && wizardTitle(l.name))
  .map((l) => ({ key: wizardKey(l.name), title: wizardTitle(l.name), lines: (l.items || []).map((i) => i.label) }))
  .filter((w) => parseWizard(w.lines).steps.length)
  .sort((a, b) => (a.key === BASIC ? -1 : b.key === BASIC ? 1 : a.title.localeCompare(b.title)));
