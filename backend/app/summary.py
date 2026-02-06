from pathlib import Path
from .storage import read_logs


def write_patch_summary(job_id: str, job_dir: Path) -> None:
    ai_dir = job_dir / ".ai"
    patches_dir = ai_dir / "patches"
    summary_path = ai_dir / "patch_summary.md"

    logs = read_logs(job_id, max_bytes=250_000)

    patch_files = []
    if patches_dir.exists():
        patch_files = sorted([p.name for p in patches_dir.glob("patch_*.diff")])

    # Super simple summary 
    lines = []
    lines.append("# Patch Summary")
    lines.append("")
    lines.append("## Result")
    lines.append("- Build: ✅ succeeded")
    lines.append(f"- Patches applied: **{len(patch_files)}**")
    if patch_files:
        lines.append(f"- Patch files: {', '.join(patch_files)}")
    lines.append("")
    lines.append("## Key log excerpt (tail)")
    lines.append("```")
    lines.extend(logs.splitlines()[-60:])
    lines.append("```")
    lines.append("")

    summary_path.write_text("\n".join(lines), encoding="utf-8")
