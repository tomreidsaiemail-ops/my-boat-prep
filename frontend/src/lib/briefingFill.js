// Fill-in tags in Role Briefings (same rules as the server's briefing_fill.py) for text the phone builds itself, e.g. the WhatsApp invite.
const dim = (f) => (b) => (String(b[f] || "").trim() ? `${String(b[f]).trim()} ${b.units === "ft" ? "ft" : "m"}` : "");
const field = (f) => (b) => String(b[f] || "").trim();
const TAGS = {
  VESSEL: field("vessel"), "BOAT NAME": field("vessel"), CALLSIGN: field("callsign"), "MMSI NUMBER": field("mmsi"), MMSI: field("mmsi"),
  SKIPPER: field("skipper"), "SKIPPER PHONE": field("skipper_phone"), MAKE: field("make"), MODEL: field("model"), YEAR: field("year_built"),
  LENGTH: dim("loa"), BEAM: dim("beam"), DRAFT: dim("draft"), "MAST HEIGHT": dim("mast_height"), "HULL COLOUR": field("hull_colour"), "HULL COLOR": field("hull_colour"),
};
const VIDEO = /<\s*YOUTUBE\s*:\s*([^>\s]+)\s*>/i;

export const BRIEFING_TAGS_HINT = "Fill-in tags: <VESSEL> <CALLSIGN> <MMSI NUMBER> <SKIPPER> <SKIPPER PHONE> <MAKE> <MODEL> <YEAR> <LENGTH> <BEAM> <DRAFT> <MAST HEIGHT> <HULL COLOUR>. Add a video at the end with <YOUTUBE:https://youtu.be/...>";

const videoUrl = (text) => {
  const m = String(text || "").match(VIDEO);
  if (!m) return "";
  try {
    const u = new URL(m[1]);
    const host = u.hostname.toLowerCase();
    return /^https?:$/.test(u.protocol) && (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) ? m[1] : "";
  } catch { return ""; }
};

// The boat's details in place of the admin's fill-in tags (a blank detail or <YOUTUBE:...> stays as written), so skippers just see their boat.
export const fillDetails = (text, boat = {}) => String(text || "")
  .replace(/<\s*([A-Za-z][A-Za-z ]*[A-Za-z])\s*>/g, (all, tag) => { const get = TAGS[tag.toUpperCase().split(/\s+/).join(" ")]; return (get && get(boat || {})) || all; });

// Plain text for messages: details filled in (a blank detail keeps its tag) and the video link at the end.
export const shownBriefing = (text, boat = {}) => {
  const url = videoUrl(text);
  const body = fillDetails(String(text || "").replace(new RegExp(VIDEO.source, "gi"), ""), boat)
    .split("\n").map((l) => l.trimEnd()).filter((l) => !["", "-"].includes(l.trim())).join("\n").trim();
  return url ? `${body}\n\nBriefing video: ${url}` : body;
};
