import os
import re
import subprocess
from pathlib import Path
from typing import Optional

import yaml

from .storage import append_log, read_logs
from .gemini_client import gemini_generate_json


def _load_ai_project(ai_dir: Path) -> dict:
    yml_path = ai_dir / "ai.project.yml"
    if not yml_path.exists():
        return {}
    return yaml.safe_load(yml_path.read_text(encoding="utf-8")) or {}


def _max_patch_loops(ai_project: dict) -> int:
    try:
        return int(ai_project.get("limits", {}).get("max_patch_loops", 3))
    except Exception:
        return 3


def _primary_build_cmd(ai_project: dict) -> str:
    # Source of truth: ai.project.yml runtime.build
    return ai_project.get("runtime", {}).get("build") or "npm run build"


def _install_cmd(ai_project: dict) -> str:
    return ai_project.get("runtime", {}).get("install") or "npm install"


def _extract_error_context(full_logs: str, max_lines: int = 220) -> str:
    """
    Pull last ~max_lines lines, then try to focus around obvious error markers.
    """
    lines = full_logs.splitlines()
    tail = lines[-max_lines:] if len(lines) > max_lines else lines

    # If we can locate an error marker, return from there to end
    markers = [
        "Error:",
        "error ",
        "TypeError",
        "ReferenceError",
        "Module not found",
        "Cannot find module",
        "TS",
        "SyntaxError",
        "Failed to compile",
        "Build failed",
    ]
    for i in range(len(tail) - 1, -1, -1):
        if any(m.lower() in tail[i].lower() for m in markers):
            return "\n".join(tail[i:])

    return "\n".join(tail)


def _list_repo_files(repo_dir: Path, limit: int = 200) -> str:
    # keep it small: first 200 paths
    paths = []
    for p in repo_dir.rglob("*"):
        if p.is_dir():
            continue
        rel = str(p.relative_to(repo_dir))
        # ignore heavy/noisy dirs
        if (
            rel.startswith("node_modules/")
            or rel.startswith(".git/")
            or rel.startswith(".next/")
        ):
            continue
        if "/.next/" in rel or "/node_modules/" in rel:
            continue
        paths.append(rel)
        if len(paths) >= limit:
            break
    return "\n".join(paths)


def _read_file_safe(repo_dir: Path, rel_path: str, limit: int = 25_000) -> str:
    p = repo_dir / rel_path
    if not p.exists() or not p.is_file():
        return ""
    txt = p.read_text(encoding="utf-8", errors="replace")
    return txt[:limit]


def _pick_relevant_files(error_context: str) -> list[str]:
    """
    Heuristic: grab file paths from logs.
    Prioritize TS compiler format: src/file.ts(1,23): error ...
    """
    prioritized: list[str] = []

    # ✅ TS compiler format: src/file.ts(1,23): error ...
    for m in re.findall(r"([A-Za-z0-9_\-./]+\.ts[x]?)\(\d+,\d+\):", error_context):
        path = m.replace("\\", "/").lstrip("./")
        if (
            "node_modules" in path
            or path.startswith(".next/")
            or path.startswith(".git/")
        ):
            continue
        if path not in prioritized:
            prioritized.append(path)

    # If we found TS paths, return them first (most reliable)
    if prioritized:
        return prioritized[:6]

    # Fallback: generic path patterns
    candidates = set()
    patterns = [
        r"(/?[\w\-.]+/)+[\w\-.]+\.(ts|tsx|js|jsx|mjs|cjs|json)",
        r"([A-Za-z]:\\[^ \n\r\t]+?\.(ts|tsx|js|jsx|json))",
    ]

    for pat in patterns:
        for m in re.findall(pat, error_context):
            path = m[0] if isinstance(m, tuple) else m
            path = path.replace("\\", "/").lstrip("./")
            if (
                "node_modules" in path
                or path.startswith(".next/")
                or path.startswith(".git/")
            ):
                continue
            candidates.add(path)

    out = list(candidates)
    return out[:6]


def generate_patch_diff(job_id: str, repo_dir: Path, ai_dir: Path) -> str:
    ai_project = _load_ai_project(ai_dir)

    full_logs = read_logs(job_id, max_bytes=400_000)
    error_context = _extract_error_context(full_logs)

    files_hint = _list_repo_files(repo_dir)
    relevant_files = _pick_relevant_files(error_context)

    # Read key files + relevant ones
    package_json = _read_file_safe(repo_dir, "package.json")
    readme = _read_file_safe(repo_dir, "README.md")
    snippets = []
    for rel in relevant_files:
        content = _read_file_safe(repo_dir, rel)
        if content:
            snippets.append(f"FILE: {rel}\n---\n{content}\n---")

    prompt = f"""
You are Autopatch, an autonomous build-fix agent.
Task: return a SINGLE unified diff patch that fixes the build failure.

Hard rules:
- Output ONLY JSON: {{ "diff": "<git diff>", "reason": "<one sentence>" }}
- "diff" MUST be a valid unified diff produced by `git diff`, including:
  - starts with: diff --git a/... b/...
  - includes: index <hash>..<hash> <mode>  (use 0000000 if unknown)
  - includes: --- a/... and +++ b/...
  - includes @@ hunks
- Do NOT rename variables/exports unless the error explicitly requires it.
- Prefer minimal, mechanical fixes (fix import path, add missing function, etc).
- If failure is env/secrets/external services: return diff="" and explain reason.
- You MUST use the provided file snippets as ground truth.
- Do NOT invent names like "hello" if they are not in the snippet.
- When fixing an import path, change ONLY the string path and keep imported identifiers unchanged.


Context:
ai.project.yml runtime:
- install: {ai_project.get("runtime", {}).get("install")}
- build: {ai_project.get("runtime", {}).get("build")}

Build error context:
{error_context}

Repo file list (partial):
{files_hint}

package.json:
{package_json}

README.md:
{readme}

Relevant file snippets:
{chr(10).join(snippets)}
""".strip()

    append_log(job_id, "[patch] asking Gemini for unified diff...")
    out = gemini_generate_json(prompt)
    diff = (out.get("diff") or "").strip()
    reason = (out.get("reason") or "").strip()
    append_log(job_id, f"[patch] reason: {reason if reason else '(no reason)'}")
    return diff


def _normalize_git_diff(diff: str) -> str:
    """
    Ensures diff is closer to git-apply-friendly format.
    Adds a dummy index line if missing.
    """
    lines = diff.splitlines()
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        out.append(line)

        # If we see diff --git and next lines don't include index, inject a dummy one.
        if line.startswith("diff --git "):
            # look ahead small window
            window = lines[i + 1 : i + 6]
            has_index = any(w.startswith("index ") for w in window)
            if not has_index:
                out.append("index 0000000..0000000 100644")
        i += 1

    return "\n".join(out).strip() + "\n"


def _looks_like_git_diff(diff: str) -> bool:
    return diff.lstrip().startswith("diff --git ") and "\n@@ " in diff


def apply_patch(
    job_id: str, repo_dir: Path, ai_dir: Path, diff: str, patch_index: int
) -> bool:
    diff = (diff or "").strip()

    if not diff:
        append_log(job_id, "[patch] empty diff returned (likely needs human/env).")
        return False

    # ✅ validate shape
    if not _looks_like_git_diff(diff):
        append_log(
            job_id,
            "[patch] diff does not look like a valid git unified diff. Rejecting.",
        )
        return False

    # ✅ normalize (adds index line if missing)
    diff = _normalize_git_diff(diff)

    patches_dir = ai_dir / "patches"
    patches_dir.mkdir(parents=True, exist_ok=True)

    patch_file = patches_dir / f"patch_{patch_index:02d}.diff"
    patch_file.write_text(diff, encoding="utf-8")  # (already ends with \n)

    # 1) sanity check: repo is a git worktree
    if not (repo_dir / ".git").exists():
        append_log(
            job_id,
            "[patch] repo_dir is not a git clone (missing .git). Cannot apply patch safely.",
        )
        return False

    append_log(job_id, f"[patch] applying patch #{patch_index}...")

    try:
        # 2) check first so we can print a useful reason
        check = subprocess.run(
            ["git", "apply", "--check", "--whitespace=nowarn", str(patch_file)],
            cwd=str(repo_dir),
            capture_output=True,
            text=True,
        )
        if check.returncode != 0:
            append_log(job_id, "[patch] git apply --check failed. stderr:")
            append_log(job_id, check.stderr.strip() or "(no stderr)")
            append_log(job_id, "[patch] trying fallback: git apply -p0")
            # 3) fallback: try with -p0 (different path stripping)
            check2 = subprocess.run(
                [
                    "git",
                    "apply",
                    "--check",
                    "-p0",
                    "--whitespace=nowarn",
                    str(patch_file),
                ],
                cwd=str(repo_dir),
                capture_output=True,
                text=True,
            )
            if check2.returncode != 0:
                append_log(job_id, "[patch] fallback check also failed. stderr:")
                append_log(job_id, check2.stderr.strip() or "(no stderr)")
                return False

            apply2 = subprocess.run(
                ["git", "apply", "-p0", "--whitespace=nowarn", str(patch_file)],
                cwd=str(repo_dir),
                capture_output=True,
                text=True,
            )
            if apply2.returncode != 0:
                append_log(job_id, "[patch] fallback apply failed. stderr:")
                append_log(job_id, apply2.stderr.strip() or "(no stderr)")
                return False

            append_log(job_id, f"[patch] patch #{patch_index} applied with -p0.")
        else:
            apply1 = subprocess.run(
                ["git", "apply", "--whitespace=nowarn", str(patch_file)],
                cwd=str(repo_dir),
                capture_output=True,
                text=True,
            )
            if apply1.returncode != 0:
                append_log(job_id, "[patch] git apply failed. stderr:")
                append_log(job_id, apply1.stderr.strip() or "(no stderr)")
                return False
            append_log(job_id, f"[patch] patch #{patch_index} applied.")

        # Save current working diff for debugging/UI
        current_diff = subprocess.check_output(
            ["git", "diff"], cwd=str(repo_dir), text=True, errors="replace"
        )
        (patches_dir / f"worktree_after_{patch_index:02d}.diff").write_text(
            current_diff, encoding="utf-8"
        )

        return True

    except Exception as e:
        append_log(job_id, f"[patch] unexpected apply error: {e}")
        return False


def patch_loop(job_id: str, repo_dir: Path, job_dir: Path) -> bool:
    ai_dir = job_dir / ".ai"
    ai_project = _load_ai_project(ai_dir)
    max_loops = _max_patch_loops(ai_project)

    install_cmd = _install_cmd(ai_project)
    build_cmd = _primary_build_cmd(ai_project)

    # We do NOT reinstall every time unless needed; for v1 keep it simple:
    # run build; if fail -> patch -> build again
    for i in range(1, max_loops + 1):
        diff = generate_patch_diff(job_id, repo_dir, ai_dir)
        ok = apply_patch(job_id, repo_dir, ai_dir, diff, i)
        if not ok:
            return False

        # re-run build in docker using same runner (jobs.py uses docker_build_repo)
        append_log(
            job_id, f"[patch] re-run build after patch #{i} (handled by jobs.py)"
        )
        return True

    return False
