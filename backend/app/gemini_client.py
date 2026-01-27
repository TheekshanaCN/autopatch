import os
from typing import Any, Dict

from google import genai


def gemini_generate_json(prompt: str) -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    model = os.environ.get("GEMINI_MODEL", "gemini-3-pro")
    client = genai.Client(api_key=api_key)

    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    )

    # google-genai returns parsed JSON already,
    # but to for safe read text and parse.
    text = resp.text
    import json
    return json.loads(text)
