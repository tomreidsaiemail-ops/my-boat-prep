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
// Questions and jumps (all hidden except the question panel itself):
//   ??Q1 Question text            a panel with one button per answer
//   ???Q1 Yes,No                  its answers (without Q1: the question above)
//   ???IF Q1 Yes then goto ##x    jump to the line after ##x when Q1 was answered Yes
//   ???goto ##x                   always jump; ##finish is the Finish panel
//   ???IF Q1 Yes                  the next panel or Finish goal only shows when Q1 was answered Yes
//   ##x                           a hidden place to jump to; Finish lines under it only show if the skipper went there
const norm = (s = "") => s.replace(/\s+/g, " ").trim().toLowerCase();
const QUESTION = /^\s*\?\?(?!\?)\s*(\S+)\s*(.*)$/;
const IFGO = /^\s*\?\?\?\s*IF\s+(\S+)\s+(.+?)\s+then\s+goto\s*(?:##)?\s*(.+)$/i;
const GOTO = /^\s*\?\?\?\s*goto\s*(?:##)?\s*(.+)$/i;
const IF = /^\s*\?\?\?\s*IF\s+(\S+)\s+(.+?)\s*$/i;
const LABEL = /^\s*##\s*(.*)$/;
const classify = (l) => {
  let m;
  if (!l.trim()) return null;
  if (FINISH.test(l)) return { type: "finish" };
  if ((m = l.match(IFGO))) return { type: "ifgo", q: norm(m[1]), a: norm(m[2]), to: norm(m[3]) };
  if ((m = l.match(GOTO))) return { type: "goto", to: norm(m[1]) };
  if ((m = l.match(IF))) return { type: "if", q: norm(m[1]), a: norm(m[2]) };
  if (/^\s*\?\?\?/.test(l)) return { type: "answers", text: l.replace(/^\s*\?\?\?/, "").trim() };
  if ((m = l.match(LABEL))) return { type: "label", name: norm(m[1]) };
  if ((m = l.match(QUESTION))) return { type: "question", q: norm(m[1]), text: m[2].trim(), answers: [] };
  return { type: "step" };
};
const panel = (n) => n.type === "step" || n.type === "question";
const addAnswers = (nodes) => {
  const qs = nodes.filter((n) => n.type === "question");
  let last = null;
  nodes.forEach((n) => {
    if (n.type === "question") last = n;
    if (n.type !== "answers") return;
    const first = n.text.split(/\s+/)[0] || "";
    const own = qs.find((q) => q.q === norm(first));
    (own || last)?.answers.push(...(own ? n.text.slice(first.length) : n.text).split(",").map((a) => a.trim()).filter(Boolean));
  });
};
// "???IF" lines straight before a Finish line belong to that line (and move with it in Edit Final).
const finishBlock = (nodes) => {
  const inBlock = new Array(nodes.length).fill(false);
  for (let i = nodes.length - 1, next = false; i >= 0; i -= 1) next = inBlock[i] = nodes[i].type === "finish" || (nodes[i].type === "if" && next);
  return inBlock;
};
export const parseWizard = (lines = []) => {
  const nodes = lines.map((line) => ({ ...classify(line), line })).filter((n) => n.type);
  addAnswers(nodes);
  const visible = nodes.map((n, i) => (panel(n) ? i : -1)).filter((i) => i >= 0);
  const block = finishBlock(nodes);
  const finish = [];
  let cond = [];
  let section = null;
  nodes.forEach((n) => {
    if (n.type === "label") section = n.name === "finish" ? null : n.name;
    if (n.type === "if") cond.push(n);
    else if (n.type === "finish") {
      const text = n.line.replace(/^\s*(-+|\$+|%+)\s*/, "");
      if (text) finish.push({ kind: kindOf(n.line), text, cond, section });
      cond = [];
    } else if (n.type !== "answers" && n.type !== "label") cond = [];
  });
  return {
    nodes, visible, finish,
    steps: visible.map((i) => (nodes[i].type === "question" ? nodes[i].text : withNext(nodes[i].line))),
    raw: visible.map((i) => nodes[i].line),
    question: visible.map((i) => (nodes[i].type === "question" && nodes[i].answers.length ? nodes[i] : null)),
    finishRaw: nodes.filter((n, i) => block[i]).map((n) => n.line.trim()),
  };
};
const said = (answers, n) => norm(answers[n.q]) === n.a;
// answers["##"] holds the ## places the skipper passed through, one list per move.
export const SEEN = "##";
// Finish goals for this skipper: their "???IF" lines match, their ## place was visited, and each shows once.
export const finishFor = (finish, answers = {}) => {
  const seen = new Set((answers[SEEN] || []).flat());
  const shown = new Set();
  return finish.filter((f) => {
    const key = `${f.kind}:${norm(f.text)}`;
    if ((f.section && !seen.has(f.section)) || !f.cond.every((c) => said(answers, c)) || shown.has(key)) return false;
    shown.add(key);
    return true;
  });
};
// The panel after panel `from` (-1 = start) for these answers (steps.length = the Finish panel), and the ## places passed on the way.
export const walk = (wiz, from, answers = {}) => {
  const { nodes, visible } = wiz;
  const place = (name) => (name === "finish" ? nodes.length : nodes.findIndex((n) => n.type === "label" && n.name === name));
  let i = from < 0 ? 0 : visible[from] + 1;
  let skip = false;
  const labels = [];
  for (let guard = 0; i < nodes.length && guard < nodes.length * 4; guard += 1) {
    const n = nodes[i];
    if (panel(n)) { if (!skip) return { to: visible.indexOf(i), labels }; skip = false; }
    else if (n.type === "label") labels.push(n.name);
    else if (n.type === "finish") skip = false;
    else if (n.type === "if" && !said(answers, n)) skip = true;
    else if (n.type === "goto" || (n.type === "ifgo" && said(answers, n))) {
      const to = place(n.to);
      if (to >= 0) { labels.push(n.to); i = to + 1; skip = false; continue; }
    }
    i += 1;
  }
  return { to: visible.length, labels };
};
export const nextPanel = (wiz, from, answers = {}) => walk(wiz, from, answers).to;
// "$$$ Crew Registration and Invites..." -> that walkthrough, if it exists.
export const linkedWizard = (wizards, text) => wizards.find((w) => w.key === text.replace(/\.+\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase());

// Basic Introduction first, then A-Z; only lists with steps.
export const wizardsFrom = (lists = []) => lists.filter((l) => isWizardName(l.name) && wizardTitle(l.name))
  .map((l) => ({ key: wizardKey(l.name), title: wizardTitle(l.name), lines: (l.items || []).map((i) => i.label) }))
  .filter((w) => parseWizard(w.lines).steps.length)
  .sort((a, b) => (a.key === BASIC ? -1 : b.key === BASIC ? 1 : a.title.localeCompare(b.title)));
