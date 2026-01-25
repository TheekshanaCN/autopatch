import subprocess
import uuid
from pathlib import Path

from .storage import append_log, init_job, write_status, get_job_paths
from .runner import docker_build_repo, run_cmd


def clone_repo(job_id: str, repo_url: str, repo_dir: Path) -> int:
    repo_dir.parent.mkdir(parents=True, exist_ok=True)
    if repo_dir.exists():
        run_cmd(job_id, f"rm -rf {repo_dir}")
    cmd = f"git clone --depth=1 {repo_url} {repo_dir}"
    return run_cmd(job_id, cmd)


def run_job(job_id: str, repo_url: str) -> None:
    paths = get_job_paths(job_id)

    write_status(job_id, state="RUNNING", step="CLONING", message="Cloning repo")
    rc = clone_repo(job_id, repo_url, paths.repo_dir)
    if rc != 0:
        write_status(job_id, state="FAILED", step="CLONING", message="Git clone failed")
        return

    write_status(job_id, state="RUNNING", step="BUILDING", message="Running install+build in Docker")
    exit_code, pkg = docker_build_repo(job_id, paths.repo_dir)
    append_log(job_id, f"[info] package_manager={pkg}")

    if exit_code == 0:
        write_status(job_id, state="SUCCESS", step="DONE", message="Build succeeded")
    else:
        write_status(job_id, state="FAILED", step="DONE", message="Build failed (see logs)")
