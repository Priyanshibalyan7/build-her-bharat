# Surveyllix MVP (free & open-source)

Natural-language search over CCTV video. Upload a clip, type what you want, get timestamped segments and an exportable clip.

## Run it
1. Install **FFmpeg** (`sudo apt install ffmpeg` / `brew install ffmpeg` / winget install ffmpeg) and Python 3.10+.
2. From `backend/`:
   ```
   python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
3. Open http://localhost:8000, upload a short video (start with 1-2 minutes), wait for indexing, search.

First run downloads the CLIP model (~600 MB) once. After that it works offline.

## Settings (environment variables)
- `MODEL_NAME` - default `openai/clip-vit-base-patch32`. Try `google/siglip-base-patch16-224` for SigLIP.
- `FRAME_FPS` - frames analysed per second (default 1). Higher = finer results, slower indexing.

## What maps to your slides
| Slide tech | In this MVP | Upgrade path |
|---|---|---|
| React/Vite/Tailwind | single `static/index.html` | Phase 2 |
| Node/Express, JWT, OAuth | FastAPI handles everything | Phase 2 |
| CLIP/SigLIP | yes (Hugging Face transformers) | - |
| FAISS | yes (`faiss-cpu`) | - |
| Redis + BullMQ | FastAPI `BackgroundTasks` | Phase 2 |
| Socket.IO | status polling every second | Phase 2 |
| MongoDB | JSON files in `data/` | Phase 2 |
| S3/MinIO | local disk | Phase 2 |
| YOLO, VLM | not yet | Phase 3 |

Hindi (Devanagari) queries are translated to English with `Helsinki-NLP/opus-mt-hi-en`. Roman-script Hinglish is passed straight to CLIP, which is weak at it; handling it properly is future work.
