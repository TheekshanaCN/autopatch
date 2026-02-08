import os
import time
import json
from typing import Any, Dict

from google import genai


def gemini_generate_json(prompt: str) -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    model = os.environ.get("GEMINI_MODEL", "gemini-3-pro")
    client = genai.Client(api_key=api_key)

    # retry on overload
    delays = [1, 2, 4]  # seconds
    last_err: Exception | None = None

    for attempt, delay in enumerate([0] + delays, start=1):
        try:
            if delay:
                time.sleep(delay)

            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.2,
                },
            )
            return json.loads(resp.text)

        except Exception as e:
            last_err = e
            msg = str(e).lower()
            # overload / temporary failures
            if ("503" in msg) or ("unavailable" in msg) or ("overloaded" in msg):
                continue
            raise

    # if still failing after retries:
    raise RuntimeError(f"Gemini request failed after retries: {last_err}")
