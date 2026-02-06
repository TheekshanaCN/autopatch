import os
import json
from pathlib import Path
import yaml
import requests
import subprocess

from .storage import append_log, write_status, get_job_paths
from .runner import docker_build_repo, run_cmd
from .scanner import scan_repo
from .context_compiler import compile_ai_context
from .patcher import generate_patch_diff, apply_patch
from .summary import write_patch_summary
from .git_ops import ensure_branch, commit_all, push_branch
from .github_pr import open_pull_request


def clone_repo(job_id: str, repo_url: str, repo_dir: Path) -> int:
    repo_dir.parent.mkdir(parents=True, exist_ok=True)
    if repo_dir.exists():
        run_cmd(job_id, f"rm -rf {repo_dir}")

    # PR-mode needs a normal clone (no --depth=1)
    cmd = f"git clone {repo_url} {repo_dir}"
    return run_cmd(job_id, cmd)


def configure_git_auth(job_id: str, repo_dir: Path, repo_url: str) -> None:
    """
    Makes git push non-interactive by injecting token into the origin remote.
    Uses x-access-token:<TOKEN>@github.com which works without a username.
    """
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        append_log(job_id, "[git] GITHUB_TOKEN not set; pushes may prompt for auth")
        return

    # Only rewrite for GitHub HTTPS URLs
    if not repo_url.startswith("https://github.com/"):
        append_log(
            job_id, "[git] repo_url is not a GitHub HTTPS URL; leaving origin unchanged"
        )
        return

    authed_url = repo_url.replace(
        "https://github.com/",
        f"https://x-access-token:{token}@github.com/",
    )

    # Don’t leak token into logs
    subprocess.check_call(
        ["git", "remote", "set-url", "origin", authed_url], cwd=str(repo_dir)
    )
    append_log(job_id, "[git] configured authenticated origin (token)")


def ensure_gitignore(job_id: str, repo_dir: Path) -> None:
    gi = repo_dir / ".gitignore"
    if gi.exists() and gi.stat().st_size > 0:
        append_log(job_id, "[git] .gitignore exists, keeping it")
        return

    append_log(job_id, "[git] .gitignore missing -> generating from template")

    # Toptal gitignore API (node template)
    api = "https://www.toptal.com/developers/gitignore/api/node"

    try:
        r = requests.get(api, timeout=20)
        r.raise_for_status()
        content = r.text.strip() + "\n"
    except Exception as e:
        append_log(job_id, f"[git] gitignore API failed, using fallback: {e}")
        content = (
            "\n".join(
                [
                    "node_modules/",
                    ".next/",
                    "dist/",
                    "build/",
                    ".turbo/",
                    ".cache/",
                    ".env",
                    ".env.*",
                    "*.log",
                ]
            )
            + "\n"
        )

    # Add extras that matter for modern JS/Next
    extras = (
        "\n".join(
            [
                "",
                "# Autopatch extras",
                ".next/",
                ".turbo/",
                ".env",
                ".env.*",
                "*.log",
            ]
        )
        + "\n"
    )

    gi.write_text(content + extras, encoding="utf-8")
    append_log(job_id, "[git] wrote generated .gitignore")


def run_job(job_id: str, repo_url: str) -> None:
    paths = get_job_paths(job_id)

    mode = os.environ.get("AUTOPATCH_MODE", "commit").lower().strip()  # "commit" | "pr"
    base_branch = os.environ.get("GITHUB_BASE_BRANCH", "main")

    # CLONING
    write_status(job_id, state="RUNNING", step="CLONING", message="Cloning repo")
    rc = clone_repo(job_id, repo_url, paths.repo_dir)
    if rc != 0:
        write_status(job_id, state="FAILED", step="CLONING", message="Git clone failed")
        return
    
    #prevent interactive git prompts (fail fast) + configure token auth for push
    os.environ["GIT_TERMINAL_PROMPT"] = "0"
    configure_git_auth(job_id, paths.repo_dir, repo_url)

    # Ensure repo has gitignore
    ensure_gitignore(job_id, paths.repo_dir)

    # DETECTING
    ai_dir = paths.job_dir / ".ai"
    ai_dir.mkdir(parents=True, exist_ok=True)

    write_status(job_id, state="RUNNING", step="DETECTING", message="Scanning repo")
    scan = scan_repo(job_id, paths.repo_dir)
    (ai_dir / "scan.json").write_text(json.dumps(scan, indent=2), encoding="utf-8")

    # COMPILING
    write_status(
        job_id,
        state="RUNNING",
        step="COMPILING",
        message="Generating ai.project.yml via Gemini",
    )
    try:
        compile_ai_context(job_id, paths.job_dir, paths.repo_dir)
    except Exception as e:
        append_log(job_id, f"[ai] compile failed: {e}")
        write_status(
            job_id,
            state="RUNNING",
            step="COMPILING",
            message="Gemini compile failed, continuing to build",
        )

    # BUILDING + PATCHING LOOP
    max_loops = 3
    ai_project_path = ai_dir / "ai.project.yml"
    if ai_project_path.exists():
        try:
            ai_project = (
                yaml.safe_load(ai_project_path.read_text(encoding="utf-8")) or {}
            )
            max_loops = int(ai_project.get("limits", {}).get("max_patch_loops", 3))
        except Exception:
            max_loops = 3

    attempt = 0
    branch_checked_out = False
    pr_branch = f"autopatch/{job_id}"

    while True:
        attempt += 1
        write_status(
            job_id,
            state="RUNNING",
            step="BUILDING",
            message=f"Build attempt {attempt} (install+build in Docker)",
        )

        exit_code, pkg = docker_build_repo(job_id, paths.repo_dir)
        append_log(job_id, f"[info] package_manager={pkg}")

        # ✅ SUCCESS
        if exit_code == 0:
            # Always write summary on success (used as PR body)
            try:
                write_patch_summary(job_id, paths.job_dir)
                append_log(job_id, "[ai] wrote .ai/patch_summary.md")
            except Exception as e:
                append_log(job_id, f"[ai] patch summary failed (continuing): {e}")

            # PR MODE: commit + push + open PR
            if mode == "pr":
                try:
                    # Ensure we're on PR branch even if build succeeded without needing a patch
                    ensure_branch(paths.repo_dir, pr_branch)
                    branch_checked_out = True
                    append_log(job_id, f"[pr] checked out branch {pr_branch}")

                    # Commit changes if any
                    commit_hash = commit_all(
                        paths.repo_dir, f"autopatch: fix build (job {job_id})"
                    )
                    if commit_hash:
                        append_log(job_id, f"[pr] committed: {commit_hash}")
                    else:
                        append_log(job_id, "[pr] nothing to commit (no changes)")

                    # Push branch
                    push_branch(paths.repo_dir, pr_branch)
                    append_log(job_id, f"[pr] pushed: {pr_branch}")

                    # PR body from patch summary
                    summary_path = ai_dir / "patch_summary.md"
                    body = (
                        summary_path.read_text(encoding="utf-8")
                        if summary_path.exists()
                        else "Autopatch changes."
                    )

                    pr_url = open_pull_request(
                        repo_url=repo_url,
                        head_branch=pr_branch,
                        title="Autopatch: Fix build failure",
                        body=body,
                    )
                    append_log(job_id, f"[pr] opened: {pr_url}")

                    write_status(
                        job_id,
                        state="SUCCESS",
                        step="DONE",
                        message=f"Build succeeded. PR: {pr_url}",
                    )
                    return

                except Exception as e:
                    append_log(job_id, f"[pr] failed: {e}")
                    # Still success, but PR failed
                    write_status(
                        job_id,
                        state="SUCCESS",
                        step="DONE",
                        message="Build succeeded (PR creation failed; see logs)",
                    )
                    return

            # commit-mode or default
            write_status(
                job_id, state="SUCCESS", step="DONE", message="Build succeeded"
            )
            return

        # ❌ FAILED BUILD: if out of patch budget, stop
        patch_index = attempt  # attempt 1 failed -> patch #1
        if patch_index > max_loops:
            try:
                write_patch_summary(job_id, paths.job_dir)
                append_log(job_id, "[ai] wrote .ai/patch_summary.md")
            except Exception as e:
                append_log(job_id, f"[ai] patch summary failed (continuing): {e}")

            write_status(
                job_id,
                state="FAILED",
                step="DONE",
                message="Build failed after max patch loops",
            )
            return

        # PATCHING
        write_status(
            job_id,
            state="RUNNING",
            step="PATCHING",
            message=f"Generating/applying patch #{patch_index}",
        )

        diff = generate_patch_diff(job_id, paths.repo_dir, ai_dir)

        # ✅ PR-mode: checkout branch BEFORE first patch so edits never touch main
        if mode == "pr" and (not branch_checked_out) and patch_index == 1:
            try:
                ensure_branch(paths.repo_dir, pr_branch)
                branch_checked_out = True
                append_log(job_id, f"[pr] checked out branch {pr_branch}")
            except Exception as e:
                append_log(job_id, f"[pr] branch checkout failed: {e}")
                # If we can't branch safely, fail (safer than patching main in PR-mode)
                try:
                    write_patch_summary(job_id, paths.job_dir)
                except Exception:
                    pass
                write_status(
                    job_id,
                    state="FAILED",
                    step="DONE",
                    message="PR branch checkout failed (see logs)",
                )
                return

        applied = apply_patch(job_id, paths.repo_dir, ai_dir, diff, patch_index)

        if not applied:
            try:
                write_patch_summary(job_id, paths.job_dir)
                append_log(job_id, "[ai] wrote .ai/patch_summary.md")
            except Exception as e:
                append_log(job_id, f"[ai] patch summary failed (continuing): {e}")

            write_status(
                job_id,
                state="FAILED",
                step="DONE",
                message="Patch not applicable or needs env (see logs)",
            )
            return

        # loop continues → rerun build
