import os
import re
import requests
from typing import Tuple


def parse_github_owner_repo(repo_url: str) -> Tuple[str, str]:
    # supports https://github.com/owner/repo or .../repo.git
    m = re.search(r"github\.com/([^/]+)/([^/]+?)(?:\.git)?$", repo_url.strip("/"))
    if not m:
        raise ValueError(f"Not a GitHub repo URL: {repo_url}")
    return m.group(1), m.group(2)


def open_pull_request(repo_url: str, head_branch: str, title: str, body: str) -> str:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN not set")

    base = os.environ.get("GITHUB_BASE_BRANCH", "main")

    owner, repo = parse_github_owner_repo(repo_url)

    api = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    payload = {
        "title": title,
        "head": head_branch,  # branch name only (same repo)
        "base": base,
        "body": body,
    }

    r = requests.post(api, json=payload, headers=headers, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"GitHub PR create failed: {r.status_code} {r.text}")

    return r.json()["html_url"]
