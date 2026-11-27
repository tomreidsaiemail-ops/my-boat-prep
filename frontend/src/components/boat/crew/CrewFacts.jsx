import { CircleCheck, ClipboardCheck, Clock, FileWarning, ShoppingBasket } from "lucide-react";
import { shoppingFor } from "@/lib/shoppers";
import { localWhen, timeAgo } from "@/lib/timeAgo";

const Line = ({ Icon, tone = "text-[var(--muted)]", testId, children }) => (
  <p className={`mt-1 flex items-start gap-1 text-xs font-bold ${tone}`} data-testid={testId}><Icon className="mt-px h-3.5 w-3.5 shrink-0" /><span>{children}</span></p>
);

const QUICK = "by Skipper's Quick Invite";
const invited = (p, joined) => {
  if (p.quick) return joined ? `Joined (${QUICK}) ${timeAgo(p.joined_at)}` : `Joined (${QUICK}) · hasn't signed in to My Boat Prep yet`;
  if (!joined) return p.declined_at ? `Invited ${timeAgo(p.created_at)} · declined ${timeAgo(p.declined_at)}` : `Invited ${timeAgo(p.created_at)} · hasn't joined yet`;
  return p.joined_at ? `Invited ${timeAgo(p.invited_at)} · joined ${timeAgo(p.joined_at)}` : "Joined the crew";
};

const registered = (r) => {
  if (r?.registered_at) return `Registered ${localWhen(r.registered_at)}`;
  if (r?.status === "pending") return `Registration asked for ${r.requested_at ? timeAgo(r.requested_at) : ""}, not filled in yet`;
  return "Not registered yet";
};

const bringing = (sent, items, aisles = []) => {
  if (!items.length) return sent ? "Nothing to buy now" : "Nothing to buy from the Trip Shopping List";
  const what = `Buying ${items.length} ${items.length === 1 ? "item" : "items"}${aisles.length ? ` from ${aisles.join(", ")}` : ""}`;
  if (!sent) return `${what} · not sent to them yet`;
  return `${what} · list sent ${timeAgo(sent.at)}${sent.count !== items.length ? " (changed since, send it again)" : ""}`;
};

// Where a crew member is with their shopping: what they're buying and whether they've been sent it.
export const ShoppingStatus = ({ sent, items, aisles, testId }) => {
  const told = items.length && sent && sent.count === items.length;
  return <Line Icon={ShoppingBasket} tone={!items.length ? "text-[var(--muted)]" : told ? "text-emerald-800" : "text-amber-800"} testId={`${testId}-provisions`}>{bringing(sent, items, aisles)}</Line>;
};

// Ready to sail: joined, registered, agreement accepted, every role briefing read, and told what to buy (or nothing to buy).
export const readyToSail = (m, reg, shopRows) => {
  const items = shoppingFor(shopRows, m.name);
  return !!(reg?.registered_at && m.agreement?.accepted_at && (m.briefings || []).every((b) => !b.has_briefing || b.read_at)
    && (!items.length || (m.shopping_sent && m.shopping_sent.count === items.length)));
};

export const ReadyBadge = ({ testId }) => (
  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--green)] px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-white" data-testid={testId}>
    <CircleCheck className="h-4 w-4" strokeWidth={3} /> Ready to sail
  </span>
);

// What the skipper checks before sailing: invite age, registration time, agreement (crew); shopping shows here only when there's none (else in its grey group).
export const CrewFacts = ({ person, reg, joined, shopRows, quick, testId }) => {
  const items = shoppingFor(shopRows, person.name);
  return (
    <>
      <Line Icon={Clock} testId={`${testId}-invited`}>{invited(person, joined)}</Line>
      {quick && <Line Icon={CircleCheck} tone="text-emerald-800" testId={`${testId}-quick-in`}>Yes, they&apos;re in ({QUICK})</Line>}
      <Line Icon={ClipboardCheck} tone={reg?.registered_at ? "text-emerald-800" : "text-amber-800"} testId={`${testId}-registered`}>{registered(reg)}</Line>
      {!joined && <Line Icon={FileWarning} tone="text-amber-800" testId={`${testId}-agreement`}>Boat agreement: signs it after joining</Line>}
      {!items.length && <ShoppingStatus sent={person.shopping_sent} items={items} testId={testId} />}
    </>
  );
};
