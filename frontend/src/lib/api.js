import axios from "axios";
import { toast } from "sonner";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });
export const MAGIC_LIMIT_EVENT = "magic-limit";
export const MAGIC_BUY_EVENT = "magic-buy";
export const openMagicBuy = () => window.dispatchEvent(new Event(MAGIC_BUY_EVENT));

// Gentle note once a day when a Magic use leaves exactly 3 free generations.
const nudgeLowBalance = (res) => {
  if (res?.headers?.["x-magic-free-left"] !== "3") return;
  const today = new Date().toLocaleDateString("en-CA");
  if (localStorage.getItem("mbp_magic_nudge") === today) return;
  localStorage.setItem("mbp_magic_nudge", today);
  toast("Only 3 free Magic generations left today", {
    id: "magic-low", duration: 8000, description: "They come back at midnight. Need more before then? Top up any time.",
    action: { label: "Buy more", onClick: openMagicBuy },
  });
};

// The daily Magic limit resets at the skipper's local midnight, so every request says which time zone they're in.
api.interceptors.request.use((config) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) config.headers["X-Timezone"] = tz;
  return config;
});
api.interceptors.response.use((res) => { nudgeLowBalance(res); return res; }, (e) => {
  if (e?.response?.status === 429 && e.response.data?.code === "daily_limit") window.dispatchEvent(new CustomEvent(MAGIC_LIMIT_EVENT, { detail: e.response.data }));
  return Promise.reject(e);
});

export const apiError = (e, fallback = "Something went wrong. Please try again.") => {
  if (e?.response?.data?.code === "daily_limit") return "Daily Magic limit reached.";
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (typeof d?.msg === "string" ? d.msg.replace(/^Value error, /, "") : "")).filter(Boolean).join(" ") || fallback;
  return e?.response ? fallback : "No connection. You need signal for this.";
};
