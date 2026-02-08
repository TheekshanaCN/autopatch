import json
from pathlib import Path
from typing import Any, Dict

from .storage import append_log


def detect_pkg_manager(repo_dir: Path) -> str:
    if (repo_dir / "pnpm-lock.yaml").exists():
        return "pnpm"
    if (repo_dir / "yarn.lock").exists():
        return "yarn"
    return "npm"


def scan_repo(job_id: str, repo_dir: Path) -> Dict[str, Any]:
    pkg_manager = detect_pkg_manager(repo_dir)

    pkg_path = repo_dir / "package.json"
    pkg_json: Dict[str, Any] = {}
    if pkg_path.exists():
        pkg_json = json.loads(pkg_path.read_text(encoding="utf-8"))

    scripts = (pkg_json.get("scripts") or {}) if pkg_json else {}
    deps = pkg_json.get("dependencies") or {}
    dev_deps = pkg_json.get("devDependencies") or {}

    framework = "unknown"
    if "next" in deps or "next" in dev_deps:
        framework = "nextjs"
    elif "vite" in deps or "vite" in dev_deps:
        framework = "vite"
    elif "express" in deps or "express" in dev_deps:
        framework = "express"

    result: Dict[str, Any] = {
        "pkg_manager": pkg_manager,
        "framework": framework,
        "scripts": {
            "dev": scripts.get("dev"),
            "build": scripts.get("build"),
            "test": scripts.get("test"),
            "lint": scripts.get("lint"),
            "typecheck": scripts.get("typecheck"),
        },
        "has_env_example": (repo_dir / ".env.example").exists(),
        "has_readme": (repo_dir / "README.md").exists() or (repo_dir / "readme.md").exists(),
    }

    append_log(job_id, f"[scan] pkg_manager={pkg_manager} framework={framework}")
    append_log(job_id, f"[scan] scripts={result['scripts']}")
    append_log(job_id, f"[scan] has_env_example={result['has_env_example']} has_readme={result['has_readme']}")
    return result
