# Thin, read-only client for Audiobookshelf (https://github.com/advplyr/audiobookshelf).
# Configured via AUDIOBOOKSHELF_URL + AUDIOBOOKSHELF_TOKEN env vars, same convention CWA
# already uses for HARDCOVER_TOKEN. If unset (or the server is unreachable), every function
# below degrades to a no-op so Bookshelf keeps working with Calibre-only data.
import os
import time

import requests

from .. import logger

log = logger.create()

_CACHE_TTL_SECONDS = 60
_cache = {"at": 0.0, "items": {}, "progress": {}}


def _config():
    url = os.environ.get("AUDIOBOOKSHELF_URL", "").rstrip("/")
    token = os.environ.get("AUDIOBOOKSHELF_TOKEN", "")
    return url, token


def is_configured():
    url, token = _config()
    return bool(url and token)


def _headers():
    return {"Authorization": "Bearer {}".format(_config()[1])}


def _get(path, timeout=8):
    url, _ = _config()
    resp = requests.get(url + path, headers=_headers(), timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def _post(path, timeout=8):
    url, _ = _config()
    resp = requests.post(url + path, headers=_headers(), timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def fetch_snapshot():
    """Returns (items_by_id, progress_by_item_id), cached for _CACHE_TTL_SECONDS.

    Never raises: on any error, falls back to the last good snapshot (or empty dicts
    if there isn't one yet), so a flaky/offline Audiobookshelf never breaks Bookshelf.
    """
    if not is_configured():
        return {}, {}
    if time.time() - _cache["at"] < _CACHE_TTL_SECONDS:
        return _cache["items"], _cache["progress"]
    try:
        items_by_id = {}
        libraries = _get("/api/libraries").get("libraries", [])
        for lib in libraries:
            if lib.get("mediaType") != "book":
                continue
            page = 0
            while True:
                data = _get("/api/libraries/{}/items?minified=1&limit=200&page={}".format(lib["id"], page))
                results = data.get("results", [])
                for item in results:
                    items_by_id[item["id"]] = item
                if len(results) < 200:
                    break
                page += 1

        auth = _post("/api/authorize")
        progress_list = (auth.get("user") or {}).get("mediaProgress", []) or []
        progress_by_item_id = {p["libraryItemId"]: p for p in progress_list if not p.get("episodeId")}

        _cache.update({"at": time.time(), "items": items_by_id, "progress": progress_by_item_id})
    except Exception as e:
        log.warning("Audiobookshelf sync failed, using last known data: {}".format(e))
    return _cache["items"], _cache["progress"]


def cover_bytes(item_id, timeout=8):
    if not is_configured():
        return None, None
    url, _ = _config()
    try:
        resp = requests.get(url + "/api/items/{}/cover".format(item_id), headers=_headers(), timeout=timeout)
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "image/jpeg")
    except Exception as e:
        log.warning("Audiobookshelf cover fetch failed for {}: {}".format(item_id, e))
        return None, None
