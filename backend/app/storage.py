import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


BASE_DIR = Path(os.environ.get("AUTOPATCH_BASE_DIR", "/tmp/autopatch"))


@dataclass
class JobPaths:
    job_dir: Path
    repo_dir: Path
    logs_file: Path
    status_file: Path


def get_job_paths(job_id: str) -> JobPaths:
    job_dir = BASE_DIR / job_id
    repo_dir = job_dir / "repo"
    logs_file = job_dir / "logs.txt"
    status_file = job_dir / "status.json"
    return JobPaths(job_dir=job_dir, repo_dir=repo_dir, logs_file=logs_file, status_file=status_file)


def init_job(job_id: str) -> JobPaths:
    paths = get_job_paths(job_id)
    paths.job_dir.mkdir(parents=True, exist_ok=True)
    # create empty logs file
    paths.logs_file.touch(exist_ok=True)
    write_status(job_id, state="PENDING", step="CREATED", message="Job created")
    return paths


def append_log(job_id: str, text: str) -> None:
    paths = get_job_paths(job_id)
    with paths.logs_file.open("a", encoding="utf-8") as f:
        f.write(text)
        if not text.endswith("\n"):
            f.write("\n")


def write_status(job_id: str, state: str, step: str, message: Optional[str] = None) -> None:
    paths = get_job_paths(job_id)
    payload: Dict[str, Any] = {
        "job_id": job_id,
        "state": state,
        "step": step,
        "message": message,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    with paths.status_file.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def read_status(job_id: str) -> Dict[str, Any]:
    paths = get_job_paths(job_id)
    if not paths.status_file.exists():
        return {"job_id": job_id, "state": "FAILED", "step": "NOT_FOUND", "message": "Job not found"}
    with paths.status_file.open("r", encoding="utf-8") as f:
        return json.load(f)


def read_logs(job_id: str, max_bytes: int = 200_000) -> str:
    paths = get_job_paths(job_id)
    if not paths.logs_file.exists():
        return ""
    data = paths.logs_file.read_bytes()
    if len(data) > max_bytes:
        data = data[-max_bytes:]
    return data.decode("utf-8", errors="replace")
