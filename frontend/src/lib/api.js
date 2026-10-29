import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });
export const MAGIC_LIMIT_EVENT = "magic-limit";

// The daily Magic limit resets at the skipper's local midnight, so every request says which time zone they're in.
api.interceptors.request.use((config) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) config.headers["X-Timezone"] = tz;
  return config;
});
api.interceptors.response.use(undefined, (e) => {
  if (e?.response?.status === 429 && e.response.data?.code === "daily_limit") window.dispatchEvent(new CustomEvent(MAGIC_LIMIT_EVENT, { detail: e.response.data }));
  return Promise.reject(e);
});

export const apiError = (e, fallback = "Something went wrong. Please try again.") => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (typeof d?.msg === "string" ? d.msg.replace(/^Value error, /, "") : "")).filter(Boolean).join(" ") || fallback;
  return e?.response ? fallback : "No connection. You need signal for this.";
};
