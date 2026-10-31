import { Anchor, CircleDashed, Cross, Info, ShoppingBasket, Tag, User, Wrench } from "lucide-react";
import { normName } from "@/lib/listCategories";

// Icon picked from the category name; "loose" and "mine" are the uncategorised and user's-own groups.
const RULES = [
  [/provision|inventory|food|galley|meal|shop|stores/, ShoppingBasket],
  [/safety|first aid|medical|emergency|rescue/, Cross],
  [/maint|service|engine|repair|electric|mechanic/, Wrench],
  [/trip|passage|voyage|dock|sail|navigat|plan|crossing/, Anchor],
  [/help|info|tip|guide|faq|learn/, Info],
];

export const iconFor = (name, kind) => {
  if (kind === "mine") return User;
  if (kind === "loose") return CircleDashed;
  const n = normName(name);
  return (RULES.find(([re]) => re.test(n)) || [null, Tag])[1];
};

export const CategoryIcon = ({ name, kind, colours, size = "md", testId }) => {
  const Icon = iconFor(name, kind);
  const box = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  return (
    <span className={`${box} inline-flex shrink-0 items-center justify-center rounded-full border`} aria-hidden="true" data-testid={testId}
      style={{ backgroundColor: colours.bg, color: colours.fg, borderColor: colours.bg === "#FFFFFF" ? "#9CA3AF" : colours.bg }}>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} strokeWidth={2.5} />
    </span>
  );
};
