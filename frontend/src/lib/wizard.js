// Model Vessel walkthroughs: every "Admin - Model Vessel - <title>" list is one wizard.
export const WIZARD_PREFIX = "Admin - Model Vessel";
export const BASIC = "basic introduction walkthrough";
const PREFIX_RE = /^\s*admin\s*-\s*model vessel\s*-\s*/i;
const FINISH = /^\s*--/;

export const isWizardName = (name = "") => PREFIX_RE.test(name);
export const wizardTitle = (name = "") => name.replace(PREFIX_RE, "").replace(/\s+/g, " ").trim();
export const wizardKey = (name = "") => wizardTitle(name).toLowerCase();

// Lines starting "--" (bold) and "---" (ticked) make the Finish panel; every other line is a step.
export const parseWizard = (lines = []) => ({
  steps: lines.filter((l) => l.trim() && !FINISH.test(l)),
  finish: lines.filter((l) => FINISH.test(l)).map((l) => ({ tick: /^\s*---/.test(l), text: l.replace(/^\s*-+\s*/, "") })).filter((f) => f.text),
});

// Basic Introduction first, then A-Z; only lists with steps.
export const wizardsFrom = (lists = []) => lists.filter((l) => isWizardName(l.name) && wizardTitle(l.name))
  .map((l) => ({ key: wizardKey(l.name), title: wizardTitle(l.name), lines: (l.items || []).map((i) => i.label) }))
  .filter((w) => parseWizard(w.lines).steps.length)
  .sort((a, b) => (a.key === BASIC ? -1 : b.key === BASIC ? 1 : a.title.localeCompare(b.title)));
