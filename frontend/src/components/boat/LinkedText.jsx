import { Fragment } from "react";
import { Youtube } from "lucide-react";

// Raw YouTube addresses (youtube.com watch/shorts/live/embed links and youtu.be short links), with or without https://
const YT = /((?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?\S+|shorts\/\S+|live\/\S+|embed\/\S+)|youtu\.be\/\S+))/gi;
const TRAIL = /[.,;:!?)\]'"]+$/;

export const splitYouTube = (text) => {
  const out = [];
  let last = 0;
  String(text ?? "").replace(YT, (match, _g, at) => {
    const url = match.replace(TRAIL, "");
    if (at > last) out.push(text.slice(last, at));
    out.push({ url: /^https?:\/\//i.test(url) ? url : `https://${url}` });
    last = at + url.length;
    return match;
  });
  if (last < String(text ?? "").length) out.push(String(text).slice(last));
  return out;
};

export const LinkedText = ({ text, testId }) => {
  const parts = splitYouTube(text);
  if (!parts.some((p) => typeof p !== "string")) return text;
  return parts.map((p, i) => (typeof p === "string" ? <Fragment key={i}>{p}</Fragment> : (
    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" title={p.url}
      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 align-middle text-xs font-bold text-red-700 underline-offset-2 hover:underline"
      data-testid={testId ? `${testId}-youtube-link-${i}` : undefined}>
      <Youtube className="h-3.5 w-3.5" />YouTube
    </a>
  )));
};
