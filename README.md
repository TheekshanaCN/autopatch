
# Autopatch

**Autopatch turns broken GitHub repositories into verified Pull Requests — automatically.**

Autopatch is an autonomous AI system built for the Action Era. Instead of suggesting code, it executes real builds, fixes real failures, verifies the results, and delivers safe Pull Requests using Gemini 3.

---

## 🚀 What Autopatch Does

Given a GitHub repository URL, Autopatch:

- Clones the repository
- Scans it to detect framework, package manager, and build scripts
- Generates an AI steering file (`ai.project.yml`) and readiness report
- Runs installs and builds inside Docker
- Analyzes real build errors
- Uses **Gemini 3** to generate minimal unified diff patches
- Applies patches safely on a job branch
- Re-runs the build to verify
- Commits changes and opens a Pull Request with full artifacts

The result is not a suggestion — it’s a **verified, reviewable fix**.

---

## 🧠 How It Works (Architecture)

```text
┌──────────────────────────┐
│        Autopatch UI      │
│  (Repo URL + Live View)  │
└─────────────┬────────────┘
              │  POST /jobs
              v
┌──────────────────────────┐
│  Autopatch Backend       │
│       (FastAPI)          │
└─────────────┬────────────┘
              │
              │ git clone
              v
┌──────────────────────────┐
│      Repo Scanner        │
│ detect framework & build │
│ scripts                  │
└─────────────┬────────────┘
              │ scan.json
              v
┌──────────────────────────┐
│ Gemini 3 (AI Studio)     │
│ Context Compile          │
│ - ai.project.yml         │
│ - readiness_report.md    │
└─────────────┬────────────┘
              │
              v
┌──────────────────────────┐
│ Docker Build Runner      │
│ install + build          │
└─────────────┬────────────┘
              │
        BUILD OK ?
         /     \
       Yes      No
        |        |
        |        v
        |   ┌──────────────────────────┐
        |   │ Gemini 3 Patch Generator │
        |   │ unified diff patch       │
        |   └─────────────┬────────────┘
        |                 |
        |          git apply patch
        |                 |
        |                 v
        |        rerun Docker build
        |                 |
        |                 ↺  (Verification Loop)
        |
        v
┌──────────────────────────┐
│ Success Artifacts        │
│ patch_summary, diffs,    │
│ logs, reports            │
└─────────────┬────────────┘
              v
┌──────────────────────────┐
│ GitHub Pull Request      │
│ autopatch/<job_id>      │
│ (never touches main)    │
└──────────────────────────┘
```

**Gemini reasons. Docker verifies. GitHub delivers.**

---

## 🧩 Built With

- **Gemini 3 API**
- **FastAPI**
- **Docker**
- **GitHub API**
- **Next.js**

---

## 🏆 Why It Matters

Most AI coding tools fail on real-world repositories because they don’t verify their output.
Autopatch closes that gap by placing AI inside a strict execution and verification loop.

---

## 🔮 What’s Next

- More language ecosystems
- Deeper test verification
- CI/CD integrations

---

**Autopatch moves AI from suggesting code to shipping verified fixes.**