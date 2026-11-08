import { useEffect, useRef, useState } from "react";
import { api, apiError } from "@/lib/api";
import { toRows } from "@/components/boat/ScanReviewDialog";

export const BATCH_MAX = 50;
let seq = 0;

// Batch Magic Scan: photos are queued and scanned one at a time in the background.
export default function useBatchScan(boatId, params = { batch: true }) {
  const [entries, setEntries] = useState([]);
  const busy = useRef(false);
  const inflight = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const patch = (key, p) => setEntries((es) => es.map((e) => (e.key === key ? { ...e, ...(typeof p === "function" ? p(e) : p) } : e)));

  useEffect(() => {
    if (busy.current) return;
    const next = entries.find((e) => e.status === "queued");
    if (!next) return;
    busy.current = true;
    patch(next.key, { status: "scanning" });
    const form = new FormData();
    form.append("file", next.blob, "cupboard.jpg");
    const ctrl = new AbortController();
    inflight.current = { key: next.key, ctrl };
    api.post(`/boats/${boatId}/scan`, form, { params, timeout: 90000, signal: ctrl.signal })
      .then(({ data }) => alive.current && patch(next.key, { status: "done", rows: toRows(data.items), items: data.items, found: data.items.length, scansLeft: data.scans_left }))
      .catch((err) => {
        if (!alive.current || ctrl.signal.aborted) return;
        const msg = apiError(err, "The AI scan didn't work");
        // Daily Magic limit: stop the whole queue (the limit dialog is already open); each photo can be retried later.
        if (err?.response?.data?.code === "daily_limit") setEntries((es) => es.map((e) => (e.key === next.key || e.status === "queued" ? { ...e, status: "error", error: msg } : e)));
        else patch(next.key, { status: "error", error: msg });
      })
      .finally(() => { busy.current = false; inflight.current = null; if (alive.current) setEntries((es) => [...es]); });
  }, [entries, boatId]); // eslint-disable-line react-hooks/exhaustive-deps
  const abort = (key) => { if (inflight.current && (!key || inflight.current.key === key)) inflight.current.ctrl.abort(); };
  useEffect(() => () => abort(), []);

  // No photo: an empty cupboard, ready to review straight away and Magic Scan later.
  const add = (name, blob, extra = {}) => setEntries((es) => [...es, blob
    ? { key: `b${(seq += 1)}`, name, blob, preview: URL.createObjectURL(blob), status: "queued", rows: [], ticked: false, ...extra }
    : { key: `b${(seq += 1)}`, name, blob: null, preview: "", status: "done", empty: true, rows: [], found: 0, ticked: false, ...extra }]);
  const remove = (key) => { abort(key); setEntries((es) => {
    const e = es.find((x) => x.key === key);
    if (e?.preview) URL.revokeObjectURL(e.preview);
    return es.filter((x) => x.key !== key);
  }); };
  const retry = (key) => patch(key, { status: "queued", error: "" });
  const clear = () => { abort(); setEntries((es) => { es.forEach((e) => e.preview && URL.revokeObjectURL(e.preview)); return []; }); };
  const position = entries.findIndex((e) => e.status === "scanning") + 1;
  return { entries, add, remove, retry, clear, patch, position };
}
