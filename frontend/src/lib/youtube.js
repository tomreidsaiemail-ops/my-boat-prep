// Raw YouTube addresses (youtube.com watch/shorts/live/embed links and youtu.be short links), with or without https://
// The leading group keeps "notyoutube.com" from matching without a lookbehind (older iPhones can't parse those).
const YT = /(^|[^\w.])((?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?\S+|shorts\/\S+|live\/\S+|embed\/\S+)|youtu\.be\/\S+))/gi;
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
