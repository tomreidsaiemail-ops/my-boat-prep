import { API } from "@/lib/api";
import { localWhen } from "@/lib/timeAgo";

const W = 1080;
const H = 1350;
const PHOTO_H = 820;

const loadPhoto = async (c) => {
  if (!c.has_photo) return null;
  const res = await fetch(`${API}/me/catches/${c.catch_id}/photo`, { credentials: "include" });
  if (!res.ok) return null;
  return createImageBitmap(await res.blob());
};

const fit = (ctx, text, max) => {
  let t = text;
  while (t.length > 3 && ctx.measureText(t).width > max) t = `${t.slice(0, -2).trimEnd()}…`;
  return t;
};

const cover = (ctx, img) => {
  const s = Math.max(W / img.width, PHOTO_H / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (PHOTO_H - h) / 2, w, h);
};

// A shareable picture card: photo, species, size, place name (never the exact GPS spot) and date.
export const catchCard = async (c, size) => {
  const r = c.report;
  const shell = r.kind === "shellfish";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, W, H);
  const img = await loadPhoto(c).catch(() => null);
  if (img) cover(ctx, img);
  else { ctx.fillStyle = "#1e3a5f"; ctx.fillRect(0, 0, W, PHOTO_H); }
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, PHOTO_H, W, H - PHOTO_H);
  ctx.fillStyle = shell ? "#7E3FBF" : "#F28C28";
  ctx.fillRect(0, PHOTO_H, W, 14);
  const x = 64;
  const max = W - x * 2;
  let y = PHOTO_H + 110;
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 72px 'Public Sans', system-ui, sans-serif";
  ctx.fillText(fit(ctx, r.species.common_name, max), x, y);
  if (r.species.scientific_name) {
    y += 58;
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "italic 400 40px 'Public Sans', system-ui, sans-serif";
    ctx.fillText(fit(ctx, r.species.scientific_name, max), x, y);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px 'Public Sans', system-ui, sans-serif";
  [size, r.place?.name, localWhen(c.created_at)].filter(Boolean).forEach((line) => { y += 70; ctx.fillText(fit(ctx, line, max), x, y); });
  ctx.fillStyle = "#fbbf24";
  ctx.font = "700 32px 'Public Sans', system-ui, sans-serif";
  ctx.fillText(fit(ctx, "Identified by the Magic Fish Whisperer · myboatprep.com", max), x, H - 56);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
};

export const shareText = (c, size) => [`My catch: ${c.report.species.common_name}`, size, c.report.place?.name, "Identified by the Magic Fish Whisperer on My Boat Prep (myboatprep.com)"].filter(Boolean).join(" · ");
