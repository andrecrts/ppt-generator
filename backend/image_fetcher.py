"""
image_fetcher.py
Fetches topic-relevant images from Unsplash.
Requires UNSPLASH_ACCESS_KEY env var (free at unsplash.com/developers).
Returns None gracefully when key is absent or request fails.
"""
import os
import httpx
from typing import Optional


def fetch_image(query: str) -> Optional[bytes]:
    """
    Fetch a landscape image for the given query.
    Returns raw image bytes or None if unavailable.
    """
    key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if not key:
        return None

    try:
        # Step 1: get a random photo matching the query
        meta = httpx.get(
            "https://api.unsplash.com/photos/random",
            params={"query": query, "orientation": "landscape", "content_filter": "high"},
            headers={"Authorization": f"Client-ID {key}"},
            timeout=10,
            follow_redirects=True,
        )
        meta.raise_for_status()
        url = meta.json()["urls"]["regular"]  # ~1080px wide

        # Step 2: download the actual image
        img = httpx.get(url, timeout=30, follow_redirects=True)
        img.raise_for_status()
        return img.content

    except Exception as exc:
        print(f"[images] Could not fetch '{query}': {exc}")
        return None
