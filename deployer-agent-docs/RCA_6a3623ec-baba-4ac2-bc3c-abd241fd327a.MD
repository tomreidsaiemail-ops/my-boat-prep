# RCA — myboatprep.com memory pressure / OOMKilled risk

**Deployment:** gemini-prototype  |  **Active run:** 6a3623ec-baba-4ac2-bc3c-abd241fd327a
**URL:** https://gemini-prototype.emergent.host (custom: myboatprep.com, www.myboatprep.com — both verified)
**Reported:** external monitoring shows memory spiking to ~100%; concern about OOMKilled before adding live traffic.

## Summary
The memory pressure is **real and well-founded**, driven by the combination of a **heavy Python import baseline** and **unbounded transient allocations** running inside a **single backend process capped at 512Mi (tier_0 Starter)**. No OOMKilled event is currently observable (see "What I could NOT prove"), but the headroom is genuinely thin and the risk is legitimate before scaling traffic.

## What consumes the memory
- **Frontend is served from Cloudflare/R2, not the pod** (`frontend_type: cloudflare`). The pod runs ONLY the backend: a **single uvicorn worker** (entrypoint has no `--workers`/gunicorn) plus a tiny nginx. So 100% of the pod memory you are monitoring is the FastAPI/uvicorn Python process — not frontend serving.

## Root causes
1. **High import-time baseline.** `server.py` imports ~40 routers at module load. Several pull very heavy native/ML stacks at top level:
   - `reportlab` — ship_log.py, folder_cards.py, service_history.py, agreement_pdf.py
   - `PIL` — ai_scan.py, paper_log.py, zone_schematics.py
   - `emergentintegrations.llm.chat` (drags in litellm + google-generativeai + tiktoken + tokenizers) — ai_lists.py, ai_scan.py, maint_ai.py, paper_log.py, zone_schematics.py, stores_ai.py
   - requirements.txt also pins numpy, pandas 3.0.6, opencv-python-headless, onnxruntime (loaded transitively).
   This import graph resident-set is a large fraction of the 512Mi ceiling **at idle**, before a single request is served, leaving little headroom.

2. **Unbounded transient spikes stack on top of that baseline:**
   - **zone_schematics._run** fans out ALL plans concurrently: `asyncio.gather(*[_one(...) for n in range(len(PLANS))])`. Each `_one` does `base64.b64decode(gemini_image)` → `Image.open(...).convert("RGB")` → `thumbnail` → JPEG save. Multiple full-res RGB bitmaps are decoded and held in memory at the same time. It is a fire-and-forget background task, so several users' jobs can overlap with no cap.
   - **ai_scan / paper_log / ai_lists**: read up to ~3MB image into memory, base64-encode (~1.33x), hold it, and stream to Gemini.
   - **reportlab PDF generation** (QR/folder cards, agreements, ship-log) builds in-memory document + embedded-image buffers.
   - **photos upload** reads the whole file into memory (`await file.read(...)`).

3. **No memory headroom controls.** tier_0: memory request 200Mi / **limit 512Mi**, CPU 50m/250m, fixed **2 replicas**, **HPA disabled, VPA disabled**. At 512Mi the pod is killed the moment baseline + concurrent spikes cross the limit.

## Evidence
- `get_tier`: tier_0 "Starter", memory 200Mi / limit **512Mi**, cpu 50m/250m, replicas 2 (max 2), hpa_enabled=false, vpa_enabled=false.
- `describe_deployment_state`: frontend_type=cloudflare (pod = backend only); active run success.
- `get_pod_events` (active run): pod Running, **restart_count 0, no kill_findings, no OOMKilled**.
- `fetch_app_logs`: app healthy (200s on /api/*); `/health` 404s are just probe noise (no /health route) — harmless.
- Source inspection (eph sandbox) confirmed the import graph, the `asyncio.gather` fan-out in zone_schematics.py, and the image/base64/reportlab paths above.

## What I could NOT prove
- **No OOMKilled event is currently observable.** The active run has 0 restarts and no kill findings. There were 5 redeploys in the last ~24h; each redeploy is a new run and K8s GCs pod events after ~1h, so any historical OOMKill on an older run is out of reach of the tools. I could not measure exact process RSS either — the backend virtualenv is not installed in the diagnostic sandbox (only build tooling is), so the baseline figure above is an informed inference from the known footprint of these libraries, not a measured number.

## Recommended fixes
### A. Resource scaling (User — Deployment Panel → Resources)
Raise the tier from tier_0 (512Mi) to get real memory headroom before adding live traffic. tier_0's 512Mi ceiling is the confirmed limiting factor tied to the reported symptom. Options shown: tier_1 Launch, tier_2 Grow, tier_3 Scale. Pick based on expected concurrency of the AI/PDF/image endpoints. (HPA/VPA are off on tier_0; a higher tier also gives autoscaling room.)

### B. Code changes (E1 / main agent) — reduce both baseline and spikes
1. **Lazy-import the heavy stacks** (biggest baseline win): move `from emergentintegrations...`, `reportlab`, and `PIL` imports from module top-level INTO the endpoint/handler functions that use them, so litellm/google-generativeai/reportlab/PIL load only on first use instead of at boot.
2. **Bound concurrency in zone_schematics._run**: replace the unbounded `asyncio.gather(all)` with a `asyncio.Semaphore(1-2)` so only 1–2 images are decoded/held at a time; explicitly `img.close()`/`del` buffers after saving.
3. **Add a global semaphore** around the memory-heavy operations (Magic Scan, PDF build, schematics) to cap simultaneous heavy requests per pod.
4. Stream/resize uploads before buffering where possible.

### C. Verification (User)
When the next spike occurs, note which endpoint is in flight (zone-schematics, /scan, PDF, upload) to confirm which path drives the peak, and re-check after the tier raise / code changes.

**Note:** Per instructions I did NOT redeploy or change any manifest.
