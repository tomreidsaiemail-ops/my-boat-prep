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

const HEADING = /^\d+\.\s/;
const tidyLine = (s) => s.replace(/\(\s*\)|\[\s*\]/g, "").replace(/\s+/g, " ").replace(/[\s:–—|-]+$/, "").trim();
// What to do with generated lines whose YouTube links don't exist: remove the links, swap in a YouTube search, or drop the lines.
export const fixYouTube = (lines, bad, mode) => {
  const byLine = bad.reduce((m, b) => ({ ...m, [b.line]: [...(m[b.line] || []), b.url] }), {});
  const strip = (line, urls) => tidyLine(urls.reduce((s, u) => s.split(u).join(" "), line));
  const out = lines.flatMap((line, i) => {
    const urls = byLine[i];
    if (!urls) return [line];
    if (mode === "drop") return [];
    const text = strip(line, urls);
    if (mode === "remove") return text ? [text] : [];
    const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(withoutYouTube(text) || text)}`;
    return [`${text} ${search}`.trim()];
  });
  // Headings left with nothing under them go, and the rest are renumbered.
  let n = 0;
  return out.filter((l, i) => !HEADING.test(l) || (out[i + 1] !== undefined && !HEADING.test(out[i + 1])))
    .map((l) => (HEADING.test(l) ? l.replace(/^\d+\./, `${(n += 1)}.`) : l));
};
