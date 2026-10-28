import { useEffect, useRef, useState } from "react";
import { api, apiError } from "@/lib/api";
import { toRows } from "@/components/boat/ScanReviewDialog";

export const BATCH_MAX = 50;
let seq = 0;

// Batch Magic Scan: photos are queued and scanned one at a time in the background.
export default function useBatchScan(boatId) {
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
    api.post(`/boats/${boatId}/scan`, form, { params: { batch: true }, timeout: 90000, signal: ctrl.signal })
      .then(({ data }) => alive.current && patch(next.key, { status: "done", rows: toRows(data.items), found: data.items.length, scansLeft: data.scans_left }))
      .catch((err) => alive.current && !ctrl.signal.aborted && patch(next.key, { status: "error", error: apiError(err, "The AI scan didn't work") }))
      .finally(() => { busy.current = false; inflight.current = null; if (alive.current) setEntries((es) => [...es]); });
  }, [entries, boatId]);
  const abort = (key) => { if (inflight.current && (!key || inflight.current.key === key)) inflight.current.ctrl.abort(); };
  useEffect(() => () => abort(), []);

  const add = (name, blob) => setEntries((es) => [...es, { key: `b${(seq += 1)}`, name, blob, preview: URL.createObjectURL(blob), status: "queued", rows: [], ticked: false }]);
  const remove = (key) => { abort(key); setEntries((es) => {
    const e = es.find((x) => x.key === key);
    if (e) URL.revokeObjectURL(e.preview);
    return es.filter((x) => x.key !== key);
  }); };
  const retry = (key) => patch(key, { status: "queued", error: "" });
  const clear = () => { abort(); setEntries((es) => { es.forEach((e) => URL.revokeObjectURL(e.preview)); return []; }); };
  const position = entries.findIndex((e) => e.status === "scanning") + 1;
  return { entries, add, remove, retry, clear, patch, position };
}
