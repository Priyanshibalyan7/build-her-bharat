"""Surveyllix MVP - natural-language search over video.

Pipeline: upload -> ffmpeg frames (1 fps) -> CLIP/SigLIP embeddings -> FAISS index.
Search:   text -> (optional Hindi->English) -> embedding -> FAISS -> merged time segments.
"""
import json
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

import imageio_ffmpeg  # bundled FFmpeg – no system install required

import faiss
import numpy as np
import torch
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel
from transformers import AutoModel, AutoModelForSeq2SeqLM, AutoProcessor, AutoTokenizer

# Swap to "google/siglip-base-patch16-224" for SigLIP - no other code change needed.
MODEL_NAME = os.getenv("MODEL_NAME", "openai/clip-vit-base-patch32")
FPS = float(os.getenv("FRAME_FPS", "1"))
BATCH = 32
ALLOWED = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
BASE = Path(__file__).resolve().parent          # always relative to this file, not the terminal's folder
DATA = BASE / "data"
DATA.mkdir(exist_ok=True)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DEVANAGARI = re.compile(r"[\u0900-\u097F]")

app = FastAPI(title="Surveyllix")
_clip = {}
_mt = {}


def clip():
    if not _clip:
        _clip["m"] = AutoModel.from_pretrained(MODEL_NAME).to(DEVICE).eval()
        _clip["p"] = AutoProcessor.from_pretrained(MODEL_NAME)
    return _clip["m"], _clip["p"]


def _tensor(x):
    return x if isinstance(x, torch.Tensor) else x.pooler_output


@torch.no_grad()
def embed_images(paths):
    model, proc = clip()
    imgs = []
    for p in paths:
        with Image.open(p) as im:
            imgs.append(im.convert("RGB"))
    inputs = proc(images=imgs, return_tensors="pt").to(DEVICE)
    f = _tensor(model.get_image_features(**inputs))
    return torch.nn.functional.normalize(f, dim=-1).cpu().numpy().astype("float32")


@torch.no_grad()
def embed_text(text):
    model, proc = clip()
    inputs = proc(text=[text], return_tensors="pt", padding="max_length", truncation=True).to(DEVICE)
    f = _tensor(model.get_text_features(**inputs))
    return torch.nn.functional.normalize(f, dim=-1).cpu().numpy().astype("float32")


def to_english(q):
    """Hindi (Devanagari) -> English using a free local model. Roman-script Hinglish passes through."""
    if not DEVANAGARI.search(q):
        return q
    if not _mt:
        name = "Helsinki-NLP/opus-mt-hi-en"
        _mt["t"] = AutoTokenizer.from_pretrained(name)
        _mt["m"] = AutoModelForSeq2SeqLM.from_pretrained(name).eval()
    batch = _mt["t"]([q], return_tensors="pt")
    out = _mt["m"].generate(**batch, max_new_tokens=64)
    return _mt["t"].decode(out[0], skip_special_tokens=True)


def run(cmd):
    """Run a command; on failure raise an error that says what actually went wrong."""
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        lines = [l for l in (r.stderr or "").strip().splitlines() if l.strip()]
        raise RuntimeError(lines[-1] if lines else f"{cmd[0]} failed")
    return r.stdout


def _ffmpeg_bin():
    """Return the path to the bundled ffmpeg binary (imageio-ffmpeg ships one)."""
    return imageio_ffmpeg.get_ffmpeg_exe()


def _ffprobe_bin():
    """Derive ffprobe path from the bundled ffmpeg binary location."""
    ffmpeg_path = Path(imageio_ffmpeg.get_ffmpeg_exe())
    # imageio-ffmpeg bundles ffmpeg; ffprobe sits in the same directory
    candidate = ffmpeg_path.parent / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if candidate.exists():
        return str(candidate)
    # Fallback: try system PATH
    system = shutil.which("ffprobe")
    if system:
        return system
    raise RuntimeError("ffprobe not found. Run: pip install imageio-ffmpeg --upgrade")


def need_ffmpeg():
    # imageio-ffmpeg always provides ffmpeg; just confirm it loads
    try:
        _ffmpeg_bin()
    except Exception as e:
        raise RuntimeError(f"FFmpeg not available: {e}")


def set_status(vid, state, pct=0, error=None):
    (DATA / vid / "status.json").write_text(json.dumps({"state": state, "progress": pct, "error": error}))


def video_path(vid):
    if not re.fullmatch(r"[0-9a-f]{12}", vid):
        raise HTTPException(404, "Video not found")
    files = list((DATA / vid).glob("video.*"))
    if not files:
        raise HTTPException(404, "Video not found")
    return files[0]


def index_video(vid):
    d = DATA / vid
    try:
        need_ffmpeg()
        src = video_path(vid)
        frames = d / "frames"
        frames.mkdir(exist_ok=True)
        set_status(vid, "extracting", 5)
        run([_ffmpeg_bin(), "-y", "-i", str(src), "-vf", f"fps={FPS}", "-q:v", "3", str(frames / "%06d.jpg")])
        files = sorted(frames.glob("*.jpg"))
        if not files:
            raise RuntimeError("No frames could be extracted from this video")
        try:
            duration = float(run([_ffprobe_bin(), "-v", "error", "-show_entries", "format=duration",
                                  "-of", "default=nw=1:nk=1", str(src)]).strip())
        except ValueError:
            duration = len(files) / FPS  # some containers report no duration
        embs = []
        for i in range(0, len(files), BATCH):
            embs.append(embed_images(files[i:i + BATCH]))
            set_status(vid, "embedding", 10 + int(85 * min(i + BATCH, len(files)) / len(files)))
        arr = np.vstack(embs)
        index = faiss.IndexFlatIP(arr.shape[1])  # inner product on unit vectors = cosine similarity
        index.add(arr)
        faiss.write_index(index, str(d / "index.faiss"))
        (d / "meta.json").write_text(json.dumps({
            "duration": duration, "fps": FPS, "times": [i / FPS for i in range(len(files))]}))
        shutil.rmtree(frames, ignore_errors=True)  # frames are no longer needed; saves disk and OneDrive sync
        set_status(vid, "ready", 100)
    except Exception as e:  # surface the failure to the UI
        set_status(vid, "error", 0, str(e))


@app.post("/api/upload")
async def upload(bg: BackgroundTasks, file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Unsupported file type. Use one of: {', '.join(sorted(ALLOWED))}")
    vid = uuid.uuid4().hex[:12]
    (DATA / vid).mkdir()
    with open(DATA / vid / f"video{ext}", "wb") as out:
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)
    set_status(vid, "queued", 0)
    bg.add_task(index_video, vid)
    return {"video_id": vid}


@app.get("/api/status/{vid}")
def status(vid: str):
    video_path(vid)
    p = DATA / vid / "status.json"
    if not p.exists():
        raise HTTPException(404, "Video not found")
    return json.loads(p.read_text())


class SearchReq(BaseModel):
    video_id: str
    query: str
    top_k: int = 20
    merge_gap: float = 3.0   # seconds
    pad: float = 2.0         # seconds added around each match
    margin: float = 0.05     # keep only frames within this score of the best frame


@app.post("/api/search")
def search(req: SearchReq):
    video_path(req.video_id)
    d = DATA / req.video_id
    if not (d / "index.faiss").exists():
        raise HTTPException(409, "Video is not indexed yet")
    if not req.query.strip():
        raise HTTPException(400, "Query is empty")
    meta = json.loads((d / "meta.json").read_text())
    q = to_english(req.query.strip())
    index = faiss.read_index(str(d / "index.faiss"))
    scores, ids = index.search(embed_text(q), min(req.top_k, index.ntotal))
    best = float(scores[0][0])
    hits = sorted((meta["times"][i], float(s)) for i, s in zip(ids[0], scores[0])
                  if i >= 0 and s >= best - req.margin)  # drops weak matches so unrelated frames don't show up
    segments, cur = [], None
    for t, s in hits:  # merge nearby frames into one segment
        if cur and t - cur["last"] <= req.merge_gap:
            cur["last"], cur["score"] = t, max(cur["score"], s)
        else:
            cur = {"first": t, "last": t, "score": s}
            segments.append(cur)
    out = [{"start": round(max(0, c["first"] - req.pad), 1),
            "end": round(min(meta["duration"], c["last"] + req.pad), 1),
            "score": round(c["score"], 4)} for c in segments]
    out.sort(key=lambda x: -x["score"])
    return {"query_used": q, "segments": out}


@app.get("/api/video/{vid}")
def video(vid: str):
    return FileResponse(video_path(vid))


@app.get("/api/clip/{vid}")
def clip_export(vid: str, start: float, end: float):
    if end <= start or start < 0:
        raise HTTPException(400, "end must be greater than start")
    src = video_path(vid)
    out_dir = DATA / vid / "clips"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{start:.1f}_{end:.1f}.mp4"
    if not out.exists():
        try:
            need_ffmpeg()
            run([_ffmpeg_bin(), "-y", "-ss", str(start), "-i", str(src), "-t", str(end - start),
                 "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", str(out)])
        except RuntimeError as e:
            raise HTTPException(500, f"Could not cut the clip: {e}")
    return FileResponse(out, media_type="video/mp4", filename=f"clip_{start:.0f}-{end:.0f}s.mp4")


static_dir = BASE / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")