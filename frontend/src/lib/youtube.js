// Raw YouTube addresses (youtube.com watch/shorts/live/embed links and youtu.be short links), with or without https://
// The leading group keeps "notyoutube.com" from matching without a lookbehind (older iPhones can't parse those).
const YT = /(^|[^\w.])((?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?\S+|shorts\/\S+|live\/\S+|embed\/\S+|playlist\?\S+|results\?\S+|channel\/\S+|c\/\S+|@\S+)|youtu\.be\/\S+))/gi;
const TRAIL = /[.,;:!?)\]'"]+$/;

// Text and link parts, e.g. ["Watch ", { url: "https://youtu.be/x" }, " first"].
export const splitYouTube = (text) => {
  const s = String(text ?? "");
  const out = [];
  let last = 0;
  s.replace(YT, (match, pre, raw, at) => {
    const url = raw.replace(TRAIL, "");
    const start = at + pre.length;
    if (start > last) out.push(s.slice(last, start));
    out.push({ url: /^https?:\/\//i.test(url) ? url : `https://${url}` });
    last = start + url.length;
    return match;
  });
  if (last < s.length) out.push(s.slice(last));
  return out;
};

// The same text with YouTube addresses taken out, for matching food names.
export const withoutYouTube = (text) => splitYouTube(text).filter((p) => typeof p === "string").join(" ").replace(/\s+/g, " ").trim();

const tidyLine = (s) => s.replace(/\(\s*\)|\[\s*\]/g, "").replace(/\s+/g, " ").replace(/[\s:–—|-]+$/, "").trim();
// Generated lines whose YouTube links don't exist get a YouTube search for the item instead.
export const swapBadYouTube = (lines, bad) => {
  const byLine = bad.reduce((m, b) => ({ ...m, [b.line]: [...(m[b.line] || []), b.url] }), {});
  return lines.flatMap((line, i) => {
    const urls = byLine[i];
    if (!urls) return [line];
    const text = tidyLine(urls.reduce((s, u) => s.split(u).join(" "), line));
    return text ? [`${text} https://www.youtube.com/results?search_query=${encodeURIComponent(withoutYouTube(text) || text)}`] : [];
  });
};
