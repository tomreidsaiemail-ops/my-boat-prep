import { useEffect, useRef, useState } from "react";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

let seq = 0;

// Paper log pages are read one at a time in the background while the skipper names and dates them.
export default function usePaperQueue(boatId) {
  const [pages, setPages] = useState([]);
  const busy = useRef(false);
  const inflight = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; inflight.current?.ctrl.abort(); }; }, []);
  const patch = (key, p) => setPages((ps) => ps.map((x) => (x.key === key ? { ...x, ...p } : x)));

  useEffect(() => {
    if (busy.current) return;
    const next = pages.find((p) => p.status === "queued");
    if (!next) return;
    busy.current = true;
    patch(next.key, { status: "scanning", error: "" });
    const ctrl = new AbortController();
    inflight.current = { key: next.key, ctrl };
    (async () => {
      const form = new FormData();
      form.append("file", await shrink(next.file, 1600), "page.jpg");
      const { data } = await api.post(`/boats/${boatId}/paper-log`, form, { timeout: 90000, signal: ctrl.signal });
      if (alive.current) patch(next.key, { status: "done", text: data.text });
    })().catch((err) => {
      if (!alive.current || ctrl.signal.aborted) return;
      const msg = apiError(err, "Couldn't read that page. Try a clearer photo.");
      // Out of Magic: stop the queue; each page can be retried later.
      if (err?.response?.status === 429) setPages((ps) => ps.map((p) => (p.key === next.key || p.status === "queued" ? { ...p, status: "error", error: msg } : p)));
      else patch(next.key, { status: "error", error: msg });
    }).finally(() => { busy.current = false; inflight.current = null; if (alive.current) setPages((ps) => [...ps]); });
  }, [pages, boatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (files) => setPages((ps) => [...ps, ...files.map((file) => ({ key: (seq += 1), file, url: URL.createObjectURL(file), title: "", date: "", status: "queued", text: "", error: "" }))]);
  const remove = (key) => {
    if (inflight.current?.key === key) inflight.current.ctrl.abort();
    setPages((ps) => { const p = ps.find((x) => x.key === key); if (p) URL.revokeObjectURL(p.url); return ps.filter((x) => x.key !== key); });
  };
  const retry = (key) => patch(key, { status: "queued", error: "" });
  useEffect(() => () => pages.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const position = pages.findIndex((p) => p.status === "scanning") + 1;
  const pending = pages.filter((p) => p.status === "queued" || p.status === "scanning").length;
  return { pages, add, remove, retry, patch, position, pending };
}
