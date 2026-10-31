import { Fragment } from "react";
import { ShoppingCart, Youtube } from "lucide-react";
import { splitYouTube } from "@/lib/youtube";

const KINDS = {
  youtube: { label: "YouTube", Icon: Youtube, cls: "bg-red-50 text-red-700" },
  amazon: { label: "Amazon", Icon: ShoppingCart, cls: "bg-[#F3E6D6] text-[#6B3F1D] ring-1 ring-[#8B5E3C]/30" },
};

// Shown inside the row's tick button, so it's a span that opens the video itself rather than a nested <a>.
const open = (e, url) => {
  e.preventDefault();
  e.stopPropagation();
  window.open(url, "_blank", "noopener,noreferrer");
};

export const LinkedText = ({ text, testId }) => {
  const parts = splitYouTube(text);
  if (!parts.some((p) => typeof p !== "string")) return text;
  const seen = { youtube: 0, amazon: 0 };
  return parts.map((p, i) => {
    if (typeof p === "string") return <Fragment key={i}>{p}</Fragment>;
    seen[p.kind] += 1;
    const { label, Icon, cls } = KINDS[p.kind];
    return (
      <span key={i} role="link" tabIndex={0} title={p.url} data-href={p.url}
        onClick={(e) => open(e, p.url)} onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e, p.url)}
        className={`mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 align-middle text-xs font-bold underline-offset-2 hover:underline ${cls}`}
        data-testid={testId ? `${testId}-${p.kind}-link-${seen[p.kind]}` : undefined}>
        <Icon className="h-3.5 w-3.5" />{label}
      </span>
    );
  });
};
