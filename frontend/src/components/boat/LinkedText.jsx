import { Fragment } from "react";
import { Youtube } from "lucide-react";
import { splitYouTube } from "@/lib/youtube";

// Shown inside the row's tick button, so it's a span that opens the video itself rather than a nested <a>.
const open = (e, url) => {
  e.preventDefault();
  e.stopPropagation();
  window.open(url, "_blank", "noopener,noreferrer");
};

export const LinkedText = ({ text, testId }) => {
  const parts = splitYouTube(text);
  if (!parts.some((p) => typeof p !== "string")) return text;
  let n = 0;
  return parts.map((p, i) => {
    if (typeof p === "string") return <Fragment key={i}>{p}</Fragment>;
    n += 1;
    return (
      <span key={i} role="link" tabIndex={0} title={p.url} data-href={p.url}
        onClick={(e) => open(e, p.url)} onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e, p.url)}
        className="mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 align-middle text-xs font-bold text-red-700 underline-offset-2 hover:underline"
        data-testid={testId ? `${testId}-youtube-link-${n}` : undefined}>
        <Youtube className="h-3.5 w-3.5" />YouTube
      </span>
    );
  });
};
