# Autopatch Backend

Autopatch Backend is a FastAPI service that automatically:
- Clones a GitHub repository
- Detects project structure
- Builds the project in Docker
- Uses AI to generate patches when builds fail
- Rebuilds and verifies fixes
- Opens a Pull Request with verified fixes

## Features
- Repo scanning & AI context compilation
- AI-driven patch generation (Gemini)
- Docker-based isolated builds
- Patch → rebuild → verify loop
- Automatic Pull Request creation
- Artifact generation (logs, diffs, reports)

## Tech Stack
- FastAPI
- Python 3.11+
- Docker
- Google Gemini API
- GitHub REST API

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `.env`:
```env
GEMINI_API_KEY=your_gemini_key
GITHUB_TOKEN=your_github_token
GITHUB_BASE_BRANCH=main
AUTOPATCH_MODE=pr
AUTOPATCH_UI_KEY=
```

Run:
```bash
uvicorn app.main:app --reload --port 8000
```
