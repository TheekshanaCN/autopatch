from dotenv import load_dotenv

load_dotenv()

import threading
import uuid
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .models import CreateJobRequest, CreateJobResponse, JobStatusResponse
from .storage import init_job, read_logs, read_status
from .jobs import run_job

app = FastAPI(title="Autopatch Backend", version="0.1.0")

# Allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple UI access key 
AUTOPATCH_UI_KEY = os.getenv("AUTOPATCH_UI_KEY", "")


@app.middleware("http")
async def ui_key_guard(request: Request, call_next):
    # allow CORS preflight
    if request.method == "OPTIONS":
        return await call_next(request)

    # Protect the /jobs API if key is configured
    if request.url.path.startswith("/jobs") and AUTOPATCH_UI_KEY:
        key = request.headers.get("X-Autopatch-Key", "")
        if key != AUTOPATCH_UI_KEY:
            raise HTTPException(status_code=401, detail="Unauthorized")

    return await call_next(request)


# Where jobs live (matches your /tmp/autopatch/<job_id>/ layout)
JOBS_ROOT = Path("/tmp/autopatch")

# Safety caps for UI downloads (avoid huge files)
MAX_ARTIFACT_BYTES = 1_000_000  # 1 MB


def _job_ai_dir(job_id: str) -> Path:
    return JOBS_ROOT / job_id / ".ai"


@app.post("/jobs", response_model=CreateJobResponse)
def create_job(req: CreateJobRequest):
    job_id = uuid.uuid4().hex[:12]
    init_job(job_id)

    # Run job in background thread (MVP)
    t = threading.Thread(target=run_job, args=(job_id, str(req.repo_url)), daemon=True)
    t.start()

    return CreateJobResponse(job_id=job_id)


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str):
    status = read_status(job_id)
    if status.get("step") == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        job_id=status["job_id"],
        state=status["state"],
        step=status["step"],
        message=status.get("message"),
    )


@app.get("/jobs/{job_id}/logs")
def get_job_logs(job_id: str):
    status = read_status(job_id)
    if status.get("step") == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, "logs": read_logs(job_id)}


# ✅ 1) List artifacts for UI
@app.get("/jobs/{job_id}/artifacts")
def list_artifacts(job_id: str):
    status = read_status(job_id)
    if status.get("step") == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="Job not found")

    ai_dir = _job_ai_dir(job_id)
    if not ai_dir.exists():
        return {"job_id": job_id, "artifacts": []}

    artifacts = []
    for p in sorted(ai_dir.rglob("*")):
        if p.is_file():
            rel = p.relative_to(ai_dir).as_posix()
            artifacts.append(
                {
                    "name": rel,
                    "size": p.stat().st_size,
                }
            )
    return {"job_id": job_id, "artifacts": artifacts}


# ✅ 2) Fetch artifact content (text) safely
@app.get(
    "/jobs/{job_id}/artifacts/{artifact_path:path}", response_class=PlainTextResponse
)
def get_artifact(job_id: str, artifact_path: str):
    status = read_status(job_id)
    if status.get("step") == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="Job not found")

    ai_dir = _job_ai_dir(job_id)

    # prevent path traversal
    target = (ai_dir / artifact_path).resolve()
    if not str(target).startswith(str(ai_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid artifact path")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")

    size = target.stat().st_size
    if size > MAX_ARTIFACT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Artifact too large ({size} bytes). Limit is {MAX_ARTIFACT_BYTES}.",
        )

    # Read as text (most artifacts are yml/md/json/diff)
    text = target.read_text(encoding="utf-8", errors="replace")
    return text
