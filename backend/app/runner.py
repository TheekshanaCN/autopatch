import os
import shlex
import subprocess
from pathlib import Path
from typing import Tuple

from .storage import append_log


def run_cmd(job_id: str, cmd: str, cwd: Path | None = None) -> int:
    """
    Runs a shell command, streams output to logs.txt, returns exit code.
    """
    append_log(job_id, f"$ {cmd}")

    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd) if cwd else None,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env=os.environ.copy(),
    )

    assert proc.stdout is not None
    for line in proc.stdout:
        append_log(job_id, line.rstrip("\n"))

    return proc.wait()


def detect_pkg_manager(repo_dir: Path) -> str:
    if (repo_dir / "pnpm-lock.yaml").exists():
        return "pnpm"
    if (repo_dir / "yarn.lock").exists():
        return "yarn"
    return "npm"


def docker_build_repo(
    job_id: str,
    repo_dir: Path,
    image: str = "autopatch-runner:latest",
) -> Tuple[int, str]:
    """
    Runs npm/pnpm/yarn install + build inside Docker, mounting repo_dir to /workspace.
    Returns (exit_code, pkg_manager).
    """

    pkg = detect_pkg_manager(repo_dir)

    if pkg == "pnpm":
        install_cmd = (
            "corepack enable "
            "&& corepack prepare pnpm@latest --activate "
            "&& pnpm install"
        )
        build_cmd = "pnpm run build"

    elif pkg == "yarn":
        install_cmd = "corepack enable && yarn install"
        build_cmd = "yarn build"

    else:
        install_cmd = "npm install"
        build_cmd = "npm run build"

    # IMPORTANT:
    # - set -e : fail fast
    # - set -u : undefined vars fail
    # - set -o pipefail : catch piped failures
    # - CI=true : forces better logs from many tools
    script = f"set -euo pipefail; {install_cmd} && {build_cmd}"

    cmd = (
        f"docker run --rm "
        f"-e CI=true "
        f"-v {shlex.quote(str(repo_dir))}:/workspace "
        f"-w /workspace "
        f"{image} "
        f"bash -lc {shlex.quote(script)}"
    )

    exit_code = run_cmd(job_id, cmd)
    return exit_code, pkg
