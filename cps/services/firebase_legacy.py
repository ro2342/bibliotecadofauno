# Thin, read-only client for the original standalone Bookshelf app's Firestore
# database, for people who still use it day-to-day alongside this project. Talks to
# the Firestore REST API directly with a hand-rolled service-account JWT auth flow
# instead of the firebase-admin SDK, so no new heavy dependencies (grpcio,
# google-cloud-firestore, ...) are added to the image - only `requests` and
# `cryptography`, both already CWA dependencies.
import base64
import json
import os
import time

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from .. import logger

log = logger.create()

_TOKEN_URI = "https://oauth2.googleapis.com/token"
_SCOPE = "https://www.googleapis.com/auth/datastore"
_CACHE_TTL_SECONDS = 60

_token_cache = {"token": None, "expires_at": 0.0}
_data_cache = {"at": 0.0, "books": [], "shelves": [], "profile": {}}


def _config():
    return {
        "project_id": os.environ.get("FIREBASE_LEGACY_PROJECT_ID", ""),
        "user_id": os.environ.get("FIREBASE_LEGACY_USER_ID", ""),
        "key_path": os.environ.get("FIREBASE_LEGACY_SERVICE_ACCOUNT_PATH", ""),
    }


def is_configured():
    cfg = _config()
    return bool(cfg["project_id"] and cfg["user_id"] and cfg["key_path"] and os.path.isfile(cfg["key_path"]))


def _b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=")


def _get_access_token():
    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    with open(_config()["key_path"], "r") as f:
        key = json.load(f)

    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claims = {
        "iss": key["client_email"],
        "scope": _SCOPE,
        "aud": key.get("token_uri", _TOKEN_URI),
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = _b64url(json.dumps(header, separators=(",", ":")).encode()) + b"." + \
        _b64url(json.dumps(claims, separators=(",", ":")).encode())

    private_key = serialization.load_pem_private_key(key["private_key"].encode(), password=None)
    signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    jwt = (signing_input + b"." + _b64url(signature)).decode()

    resp = requests.post(key.get("token_uri", _TOKEN_URI), data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt,
    }, timeout=8)
    resp.raise_for_status()
    token_data = resp.json()

    _token_cache["token"] = token_data["access_token"]
    _token_cache["expires_at"] = time.time() + token_data.get("expires_in", 3600)
    return _token_cache["token"]


def _decode_value(v):
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return v["doubleValue"]
    if "booleanValue" in v:
        return v["booleanValue"]
    if "timestampValue" in v:
        return v["timestampValue"]
    if "nullValue" in v:
        return None
    if "arrayValue" in v:
        return [_decode_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return _decode_fields(v["mapValue"].get("fields", {}))
    return None


def _decode_fields(fields):
    return {k: _decode_value(v) for k, v in fields.items()}


def _list_documents(project_id, token, path):
    url = "https://firestore.googleapis.com/v1/projects/{}/databases/(default)/documents/{}".format(
        project_id, path)
    docs = []
    page_token = None
    while True:
        params = {"pageSize": 300}
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(url, headers={"Authorization": "Bearer " + token}, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for d in data.get("documents", []):
            doc_id = d["name"].rsplit("/", 1)[-1]
            docs.append(dict(_decode_fields(d.get("fields", {})), id=doc_id))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return docs


def _get_document(project_id, token, path):
    url = "https://firestore.googleapis.com/v1/projects/{}/databases/(default)/documents/{}".format(
        project_id, path)
    resp = requests.get(url, headers={"Authorization": "Bearer " + token}, timeout=8)
    if resp.status_code == 404:
        return {}
    resp.raise_for_status()
    return _decode_fields(resp.json().get("fields", {}))


def fetch_snapshot():
    """Returns (books, shelves, profile), cached for _CACHE_TTL_SECONDS.

    Never raises: on any error, falls back to the last good snapshot (or empty on
    the first call), so a flaky/offline Firestore never breaks Bookshelf.
    """
    if not is_configured():
        return [], [], {}
    if time.time() - _data_cache["at"] < _CACHE_TTL_SECONDS:
        return _data_cache["books"], _data_cache["shelves"], _data_cache["profile"]
    try:
        cfg = _config()
        token = _get_access_token()
        base = "users/{}".format(cfg["user_id"])
        books = _list_documents(cfg["project_id"], token, base + "/books")
        shelves = _list_documents(cfg["project_id"], token, base + "/shelves")
        profile = _get_document(cfg["project_id"], token, base + "/profile/data")
        _data_cache.update({"at": time.time(), "books": books, "shelves": shelves, "profile": profile})
    except Exception as e:
        log.warning("Firebase legacy sync failed, using last known data: {}".format(e))
    return _data_cache["books"], _data_cache["shelves"], _data_cache["profile"]
