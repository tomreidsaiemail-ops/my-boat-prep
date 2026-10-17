import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });

export const apiError = (e, fallback = "Something went wrong. Please try again.") => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (typeof d?.msg === "string" ? d.msg.replace(/^Value error, /, "") : "")).filter(Boolean).join(" ") || fallback;
  return e?.response ? fallback : "No connection. You need signal for this.";
};
