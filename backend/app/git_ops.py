import subprocess
from pathlib import Path


def ensure_branch(repo_dir: Path, branch: str) -> None:
    # if branch exists locally, checkout; else create
    r = subprocess.run(["git", "rev-parse", "--verify", branch], cwd=str(repo_dir), capture_output=True, text=True)
    if r.returncode == 0:
        subprocess.check_call(["git", "checkout", branch], cwd=str(repo_dir))
    else:
        subprocess.check_call(["git", "checkout", "-b", branch], cwd=str(repo_dir))


def commit_all(repo_dir: Path, message: str) -> str:
    subprocess.check_call(["git", "add", "-A"], cwd=str(repo_dir))
    # allow empty commit? no
    status = subprocess.check_output(["git", "status", "--porcelain"], cwd=str(repo_dir), text=True).strip()
    if not status:
        return ""  # nothing to commit
    subprocess.check_call(["git", "commit", "-m", message], cwd=str(repo_dir))
    return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=str(repo_dir), text=True).strip()


def push_branch(repo_dir: Path, branch: str) -> None:
    subprocess.check_call(["git", "push", "-u", "origin", branch], cwd=str(repo_dir))
