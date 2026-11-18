// Model Vessel walkthroughs: every "Admin - Model Vessel - <title>" list is one wizard.
import { splitDoItForMe } from "@/lib/doItForMe";

export const WIZARD_PREFIX = "Admin - Model Vessel";
export const BASIC = "basic introduction walkthrough";
const PREFIX_RE = /^\s*admin\s*-\s*model vessel\s*-\s*/i;
const FINISH = /^\s*(--|\$\$|%%)/;

export const isWizardName = (name = "") => PREFIX_RE.test(name);
export const wizardTitle = (name = "") => name.replace(PREFIX_RE, "").replace(/\s+/g, " ").trim();
export const wizardKey = (name = "") => wizardTitle(name).toLowerCase();
export const CONFIG = "Admin - Global Config";
// "Admin - Global Config" line "Starting Model Vessel Wizard, <walkthrough list name>": that walkthrough's key.
export const startingWizard = (lists = []) => {
  const line = (lists[0]?.items || []).map((i) => i.label.match(/^\s*starting model vessel wizard\s*[,:;-]?\s*(.+)$/i)).find(Boolean);
  return line ? wizardKey(line[1]) : "";
};

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
//   ##x                           a hidden place to jump to. "--", "$$", "$$$" lines under it (not under ##finish)
//                                 make their own panel of ideas and links, with Next; ##finish lines and the last lines
//                                 of the list go on the Finish panel
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
const panel = (n) => n.type === "step" || n.type === "question" || n.type === "rich";
const finishItem = (line, cond = []) => ({ kind: kindOf(line), text: line.replace(/^\s*(-+|\$+|%+)\s*/, ""), cond });
// Finish-style lines inside a ## place (other than ##finish) become one panel, where they are; "???IF" lines just before a line go with it.
// The last run of Finish lines at the bottom of the list always stays on the Finish panel.
const group = (nodes) => {
  const out = [];
  let section = null;
  const tail = nodes.reduce((last, n, i) => (n.type === "finish" || n.type === "if" ? last : i), -1);
  nodes.forEach((n, i) => {
    if (n.type === "label") section = n.name === "finish" ? null : n.name;
    if (n.type !== "finish" || !section || i > tail) { out.push(n); return; }
    const cond = [];
    while (out[out.length - 1]?.type === "if") cond.unshift(out.pop());
    const last = out[out.length - 1];
    if (last?.type === "rich") last.items.push(finishItem(n.line, cond));
    else out.push({ type: "rich", line: n.line, items: [finishItem(n.line, cond)] });
  });
  return out;
};
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
  const nodes = group(lines.map((line) => ({ ...classify(line), line })).filter((n) => n.type));
  addAnswers(nodes);
  const visible = nodes.map((n, i) => (panel(n) ? i : -1)).filter((i) => i >= 0);
  const block = finishBlock(nodes);
  const finish = [];
  let cond = [];
  nodes.forEach((n) => {
    if (n.type === "if") cond.push(n);
    else if (n.type === "finish") { finish.push(finishItem(n.line, cond)); cond = []; }
    else if (n.type !== "answers" && n.type !== "label") cond = [];
  });
  const rich = (i) => nodes[i].type === "rich";
  let k = 0;
  return {
    nodes, visible, finish: finish.filter((f) => f.text),
    steps: visible.map((i) => (nodes[i].type === "question" ? nodes[i].text : rich(i) ? nodes[i].items.map((f) => f.text).join(" · ") : withNext(splitDoItForMe(nodes[i].line).text))),
    // "Do it for me" boxes and values for a step ending with @@DOITFORME,KEY=value,...
    fill: visible.map((i) => (nodes[i].type === "step" ? splitDoItForMe(nodes[i].line).fill : null)),
    raw: visible.map((i) => (rich(i) ? "" : nodes[i].line)),
    // Ideas-and-links panels (no Edit Step); editAt is a step's number on the server, which doesn't count those panels.
    rich: visible.map((i) => (rich(i) ? nodes[i].items.filter((f) => f.text) : null)),
    editAt: visible.map((i) => (rich(i) ? -1 : k++)),
    question: visible.map((i) => (nodes[i].type === "question" && nodes[i].answers.length ? nodes[i] : null)),
    finishRaw: nodes.filter((n, i) => block[i]).map((n) => n.line.trim()),
  };
};
const said = (answers, n) => norm(answers[n.q]) === n.a;
// Finish (or ideas panel) lines for this skipper: their "???IF" lines match, and each shows once.
export const finishFor = (finish, answers = {}) => {
  const shown = new Set();
  return finish.filter((f) => {
    const key = `${f.kind}:${norm(f.text)}`;
    if (!f.cond.every((c) => said(answers, c)) || shown.has(key)) return false;
    shown.add(key);
    return true;
  });
};
// The panel after panel `from` (-1 = start) for these answers; steps.length means the Finish panel.
export const nextPanel = (wiz, from, answers = {}) => {
  const { nodes, visible } = wiz;
  const place = (name) => (name === "finish" ? nodes.length : nodes.findIndex((n) => n.type === "label" && n.name === name));
  let i = from < 0 ? 0 : visible[from] + 1;
  let skip = false;
  for (let guard = 0; i < nodes.length && guard < nodes.length * 4; guard += 1) {
    const n = nodes[i];
    if (panel(n)) {
      const empty = n.type === "rich" && !finishFor(n.items, answers).length;
      if (!skip && !empty) return visible.indexOf(i);
      skip = false;
    }
    else if (n.type === "finish") skip = false;
    else if (n.type === "if" && !said(answers, n)) skip = true;
    else if (n.type === "goto" || (n.type === "ifgo" && said(answers, n))) {
      const to = place(n.to);
      if (to >= 0) { i = to + 1; skip = false; continue; }
    }
    i += 1;
  }
  return visible.length;
};
// "$$$ Crew Registration and Invites..." -> that walkthrough, if it exists.
export const linkedWizard = (wizards, text) => wizards.find((w) => w.key === text.replace(/\.+\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase());

// Basic Introduction first, then A-Z; only lists with steps.
export const wizardsFrom = (lists = []) => lists.filter((l) => isWizardName(l.name) && wizardTitle(l.name))
  .map((l) => ({ key: wizardKey(l.name), title: wizardTitle(l.name), lines: (l.items || []).map((i) => i.label) }))
  .filter((w) => parseWizard(w.lines).steps.length)
  .sort((a, b) => (a.key === BASIC ? -1 : b.key === BASIC ? 1 : a.title.localeCompare(b.title)));
