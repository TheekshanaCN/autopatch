import json
from pathlib import Path
from typing import Dict, Any

from .gemini_client import gemini_generate_json
from .storage import append_log


def _read_text_if_exists(p: Path, limit: int = 60_000) -> str:
    if not p.exists():
        return ""
    txt = p.read_text(encoding="utf-8", errors="replace")
    return txt[:limit]


def compile_ai_context(job_id: str, job_dir: Path, repo_dir: Path) -> None:
    ai_dir = job_dir / ".ai"
    ai_dir.mkdir(parents=True, exist_ok=True)

    scan_path = ai_dir / "scan.json"
    scan = json.loads(scan_path.read_text(encoding="utf-8"))

    # Gather minimal but high-signal context
    package_json = _read_text_if_exists(repo_dir / "package.json")
    readme = _read_text_if_exists(repo_dir / "README.md")
    next_config = _read_text_if_exists(repo_dir / "next.config.js") or _read_text_if_exists(repo_dir / "next.config.mjs")
    tsconfig = _read_text_if_exists(repo_dir / "tsconfig.json")

    tree_hint = "\n".join(sorted([str(p.relative_to(repo_dir)) for p in repo_dir.glob("*")][:60]))

    prompt = f"""
You are an expert "AI project context compiler".
Your job: produce a machine-usable context bundle for an autonomous build-fix agent.

Return STRICT JSON ONLY matching this schema:

{{
  "ai_project_yml": {{
    "version": 1,
    "project": {{
      "name": string,
      "purpose": string
    }},
    "runtime": {{
      "language": "node",
      "framework": string,
      "package_manager": "npm"|"pnpm"|"yarn",
      "install": string,
      "build": string,
      "dev": string|null,
      "test": string|null,
      "lint": string|null,
      "typecheck": string|null
    }},
    "verification": {{
      "primary": "build",
      "secondary": [ "lint", "typecheck", "test" ]
    }},
    "env": {{
      "required": [string],
      "optional": [string]
    }},
    "limits": {{
      "max_patch_loops": 3
    }}
  }},
  "readiness_report_md": string,
  "env_example": {{
    "required": [string],
    "optional": [string]
  }}
}}

Rules:
- Fill install/build/dev/lint/test/typecheck commands from scan/scripts if available.
- If a script is missing, set its value to null and mention it in readiness_report_md.
- Infer env var names by scanning code patterns like process.env.X, but if unsure keep lists small.
- If no .env.example exists, include that as a top readiness issue.
- Readiness report should be short, actionable bullet points.
- Do NOT invent secrets or values. Only names.

Input data:

SCAN_JSON:
{json.dumps(scan, indent=2)}

FILE_TREE_HINT (top-level):
{tree_hint}

package.json:
{package_json}

README.md:
{readme}

next config:
{next_config}

tsconfig:
{tsconfig}
""".strip()

    append_log(job_id, "[ai] generating ai.project.yml + readiness report via Gemini...")
    out = gemini_generate_json(prompt)

    # Render outputs
    ai_project = out["ai_project_yml"]
    readiness_md = out["readiness_report_md"]
    env_example = out["env_example"]

    # Write ai.project.yml as YAML (simple writer)
    yml_lines = []
    def y(k, v, indent=0):
        sp = "  " * indent
        if isinstance(v, dict):
            yml_lines.append(f"{sp}{k}:")
            for kk, vv in v.items():
                y(kk, vv, indent + 1)
        elif isinstance(v, list):
            yml_lines.append(f"{sp}{k}:")
            for item in v:
                yml_lines.append(f"{sp}  - {item}")
        elif v is None:
            yml_lines.append(f"{sp}{k}: null")
        else:
            # quote strings safely
            if isinstance(v, str):
                vv = v.replace('"', '\\"')
                yml_lines.append(f'{sp}{k}: "{vv}"')
            else:
                yml_lines.append(f"{sp}{k}: {v}")

    for top_k, top_v in ai_project.items():
        y(top_k, top_v, 0)

    (ai_dir / "ai.project.yml").write_text("\n".join(yml_lines) + "\n", encoding="utf-8")
    (ai_dir / "readiness_report.md").write_text(readiness_md.strip() + "\n", encoding="utf-8")

    # Write .env.example
    env_lines = []
    for name in env_example.get("required", []):
        env_lines.append(f"{name}=")
    if env_example.get("optional"):
        env_lines.append("")
        env_lines.append("# Optional")
        for name in env_example.get("optional", []):
            env_lines.append(f"{name}=")

    (ai_dir / ".env.example").write_text("\n".join(env_lines).strip() + "\n", encoding="utf-8")

    append_log(job_id, "[ai] wrote .ai/ai.project.yml, .ai/readiness_report.md, .ai/.env.example")
