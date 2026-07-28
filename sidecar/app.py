# Bookshelf CWA export sidecar.
#
# Standalone, read-only companion to a stock (unforked) calibre-web-automated install.
# Reads app.db and metadata.db directly via SQLite (mode=ro) instead of running inside
# CWA's own code, so CWA itself never needs to be forked/rebuilt just to expose this -
# `docker pull crocodilestick/calibre-web-automated:latest` stays the only maintenance
# CWA itself needs. Serves the exact same GET /api/export contract (token header, CORS
# to one configured origin) that ro2342/bookshelf's syncCwa() already expects, so the
# static site's code doesn't change at all - it just points at this sidecar's URL.
#
# Tradeoff versus the previous embedded-fork approach: table/column names below are
# CWA's own additions on top of Calibre's stable metadata.db schema (book_read_link,
# kobo_reading_state, kobo_bookmark, shelf, book_shelf_link, user) and could in
# principle change in a future CWA release - there's no SQLAlchemy model to catch that
# for you here, just raw SQL. That's the price paid for not maintaining a Docker image.
import hmac
import os
import sqlite3

from flask import Flask, Response, abort, jsonify, request, send_file

app = Flask(__name__)

CWA_CONFIG_DB = os.environ.get("CWA_CONFIG_DB", "/cwa-config/app.db")
CALIBRE_LIBRARY_DB = os.environ.get("CALIBRE_LIBRARY_DB", "/calibre-library/metadata.db")
CALIBRE_LIBRARY_PATH = os.environ.get("CALIBRE_LIBRARY_PATH", "/calibre-library")
EXPORT_TOKEN = os.environ.get("EXPORT_TOKEN", "")
EXPORT_USERNAME = os.environ.get("EXPORT_USERNAME", "")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "")

# Matches ub.ReadBook.STATUS_UNREAD/FINISHED/IN_PROGRESS in the CWA source.
STATUS_MAP = {0: "quero-ler", 1: "lido", 2: "lendo"}


def _ro_connect(path):
    conn = sqlite3.connect("file:{}?mode=ro".format(path), uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _apply_cors(resp):
    if ALLOWED_ORIGIN:
        resp.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Headers"] = "X-Bookshelf-Token"
        resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return resp


def _token_ok():
    # hmac.compare_digest() raises TypeError on non-ASCII str input (a real CPython
    # restriction) - encode to bytes first so this works regardless of token content.
    if not EXPORT_TOKEN:
        return False
    provided = request.headers.get("X-Bookshelf-Token", "").encode("utf-8")
    expected = EXPORT_TOKEN.encode("utf-8")
    return hmac.compare_digest(provided, expected)


@app.route("/api/export", methods=["GET", "OPTIONS"])
def export():
    if request.method == "OPTIONS":
        return _apply_cors(Response(status=204))
    if not EXPORT_TOKEN:
        return _apply_cors(jsonify({"status": "error", "message": "export disabled"})), 404
    if not _token_ok():
        return _apply_cors(jsonify({"status": "error", "message": "invalid token"})), 401

    try:
        cwa = _ro_connect(CWA_CONFIG_DB)
        cal = _ro_connect(CALIBRE_LIBRARY_DB)
    except sqlite3.OperationalError as e:
        return _apply_cors(jsonify({"status": "error", "message": "database unavailable: {}".format(e)})), 500

    try:
        user_row = cwa.execute("SELECT id FROM user WHERE name = ?", (EXPORT_USERNAME,)).fetchone()
        if not user_row:
            return _apply_cors(jsonify({"status": "error", "message": "configured user not found"})), 500
        user_id = user_row["id"]

        read_by_book = {r["book_id"]: r for r in cwa.execute(
            "SELECT book_id, read_status, last_modified, last_time_started_reading "
            "FROM book_read_link WHERE user_id = ?", (user_id,))}

        base_url = request.host_url.rstrip("/")
        books = []
        for b in cal.execute("SELECT id, title, author_sort, has_cover FROM books"):
            rb = read_by_book.get(b["id"])
            status = STATUS_MAP.get(rb["read_status"], "quero-ler") if rb else "quero-ler"

            comment = cal.execute("SELECT text FROM comments WHERE book = ?", (b["id"],)).fetchone()

            books.append({
                "title": b["title"],
                "author": b["author_sort"],
                "coverUrl": "{}/api/cover/{}".format(base_url, b["id"]) if b["has_cover"] else "",
                "synopsis": comment["text"] if comment else "",
                "status": status,
                # Not currentProgress: on the ro2342/bookshelf side that field means
                # "current page number" for mediaType digital/fisico (see app.js's
                # progress editor), and Kobo's own progress_percent (0-100, confirmed
                # against cps/progress_syncing/protocols/kosync.py's ">= 99.0" check)
                # isn't a page number - sending it would just show a bogus page count.
                # Status alone carries what the sync in app.js actually needs.
                "startDate": rb["last_time_started_reading"] if rb else None,
                "endDate": rb["last_modified"] if (rb and rb["read_status"] == 1) else None,
                "mediaType": "digital",
            })

        return _apply_cors(jsonify({"status": "success", "data": {"books": books}}))
    finally:
        cwa.close()
        cal.close()


@app.route("/api/cover/<int:book_id>")
def cover(book_id):
    # Not token-gated: <img src> can't send custom headers, and a cover image alone
    # isn't sensitive - same tradeoff CWA itself makes when anonymous browsing is on.
    cal = _ro_connect(CALIBRE_LIBRARY_DB)
    try:
        row = cal.execute("SELECT path FROM books WHERE id = ?", (book_id,)).fetchone()
    finally:
        cal.close()
    if not row:
        abort(404)
    cover_path = os.path.join(CALIBRE_LIBRARY_PATH, row["path"], "cover.jpg")
    if not os.path.isfile(cover_path):
        abort(404)
    return _apply_cors(send_file(cover_path, mimetype="image/jpeg"))


@app.route("/healthz")
def healthz():
    return "ok"


if __name__ == "__main__":
    from waitress import serve
    serve(app, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
