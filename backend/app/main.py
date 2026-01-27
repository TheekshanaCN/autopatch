from dotenv import load_dotenv
load_dotenv()

import threading
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
