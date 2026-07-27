from flask import Blueprint, render_template, request, jsonify, url_for, Response, abort
# Bookshelf Integration - ported onto calibre-web-automated.
# Reading status/progress is read from and written back to CWA's own tables
# (ReadBook, KoboReadingState/KoboBookmark) so Kobo/KOReader sync and the
# Bookshelf UI stay in sync automatically. Fields CWA has no concept of
# (personal notes, manual dates, "abandonado" status, review text, etc.) are
# stored in current_user.view_settings['bookshelf'], which already exists on
# every user row - no new tables/migrations needed.
#
# Audiobooks tracked in Audiobookshelf (github.com/advplyr/audiobookshelf) are merged
# in read-only: matched against Calibre books by normalized title+author when possible,
# otherwise shown as a synthetic "abs:<item_id>" card. See cps/services/audiobookshelf.py.
#
# Books still tracked in the original standalone Bookshelf app (Firestore) are merged
# the same way, "fb:<id>" cards, for people who keep using both. Unlike Audiobookshelf,
# Firebase is the *only* source for personal rating/review/dates/etc, so those fields
# are always kept in sync from there (last sync wins); only status/progress use the
# same "only moves forward" rule as Audiobookshelf, so it never regresses what CWA's
# own Kobo tracking already knows for a matched book. See cps/services/firebase_legacy.py.
from .cw_login import current_user
from .usermanagement import user_login_required as login_required
import os
import re
from datetime import datetime, timezone
from . import ub, db, calibre_db, logger
from .services import audiobookshelf
from .services import firebase_legacy

bookshelf = Blueprint('bookshelf', __name__,
                     url_prefix='/bookshelf',
                     template_folder='templates/bookshelf',
                     static_folder='static/bookshelf')

log = logger.create()

STATUS_MAP = {
    ub.ReadBook.STATUS_UNREAD: 'quero-ler',
    ub.ReadBook.STATUS_IN_PROGRESS: 'lendo',
    ub.ReadBook.STATUS_FINISHED: 'lido',
}
NATIVE_STATUSES = {'quero-ler': ub.ReadBook.STATUS_UNREAD,
                   'lendo': ub.ReadBook.STATUS_IN_PROGRESS,
                   'lido': ub.ReadBook.STATUS_FINISHED}


def _bookshelf_ns():
    return (current_user.view_settings or {}).get('bookshelf', {}) or {}


def _manual_books():
    return _bookshelf_ns().get('books', {}) or {}


def _get_or_create_read_book(book_id):
    rb = ub.session.query(ub.ReadBook).filter_by(user_id=current_user.id, book_id=book_id).first()
    if not rb:
        rb = ub.ReadBook(user_id=current_user.id, book_id=book_id)
        ub.session.add(rb)
        ub.session.flush()
    return rb


def _apply_native_status(rb, status_str):
    # Only lido/lendo/quero-ler exist in CWA's own model; 'abandonado' is
    # Bookshelf-only and falls back to STATUS_UNREAD on the CWA side so
    # Kobo/stats pages keep behaving sanely.
    new_status = NATIVE_STATUSES.get(status_str, ub.ReadBook.STATUS_UNREAD)
    if new_status == ub.ReadBook.STATUS_IN_PROGRESS and rb.read_status != ub.ReadBook.STATUS_IN_PROGRESS:
        rb.times_started_reading = (rb.times_started_reading or 0) + 1
        rb.last_time_started_reading = datetime.now(timezone.utc)
    rb.read_status = new_status


def _norm(s):
    return re.sub(r'[^a-z0-9]+', '', (s or '').lower())


def _abs_ts(ms):
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()


_STATUS_RANK = {'quero-ler': 0, 'abandonado': 0, 'lendo': 1, 'lido': 2}


def _format_duration(seconds):
    if not seconds:
        return None
    seconds = int(seconds)
    return '{:02d}:{:02d}:{:02d}'.format(seconds // 3600, (seconds % 3600) // 60, seconds % 60)


def _merge_audiobookshelf(books_data, manual_books):
    abs_items, abs_progress = audiobookshelf.fetch_snapshot()
    if not abs_items:
        return

    calibre_index = {(_norm(b['title']), _norm(b['author'])): b for b in books_data}

    for item_id, item in abs_items.items():
        meta = (item.get('media') or {}).get('metadata') or {}
        title = meta.get('title', '')
        author = meta.get('authorName', '')
        prog = abs_progress.get(item_id)
        abs_status = 'quero-ler'
        if prog:
            if prog.get('isFinished'):
                abs_status = 'lido'
            elif prog.get('currentTime'):
                abs_status = 'lendo'

        match = calibre_index.get((_norm(title), _norm(author)))
        if match is not None:
            match['hasAudiobook'] = True
            match_manual = manual_books.get(str(match['id']), {})
            if prog:
                if 'status' not in match_manual and _STATUS_RANK.get(abs_status, 0) > _STATUS_RANK.get(match['status'], 0):
                    match['status'] = abs_status
                # Don't touch the book's own currentProgress/totalTime here - those are
                # page-based for a matched ebook (see _format_duration docstring context
                # above). Expose the audiobook's own progress as separate fields instead.
                match['audiobookProgress'] = _format_duration(prog.get('currentTime'))
                match['audiobookTotalTime'] = _format_duration(prog.get('duration'))
                if not match.get('startDate') and prog.get('startedAt'):
                    match['startDate'] = _abs_ts(prog.get('startedAt'))
                if not match.get('endDate') and prog.get('finishedAt'):
                    match['endDate'] = _abs_ts(prog.get('finishedAt'))
            continue

        # No matching Calibre book - show as its own, Audiobookshelf-only card.
        # currentProgress/totalTime are in seconds/"HH:MM:SS" here (not a 0-1 fraction) -
        # that's what the mediaType == 'audiobook' progress editor in app.js expects.
        virtual_id = 'abs:{}'.format(item_id)
        manual = manual_books.get(virtual_id, {})
        status = manual.get('status', abs_status)
        progress = manual.get('currentProgress', (prog.get('currentTime') if prog else 0) or 0)
        total_time = manual.get('totalTime', _format_duration(prog.get('duration')) if prog else None)
        series = meta.get('seriesName', '')
        if not series and meta.get('series'):
            series = meta['series'][0].get('name', '')

        entry = {
            'id': virtual_id,
            'title': title,
            'author': author,
            'coverUrl': url_for('bookshelf.abs_cover', item_id=item_id),
            'synopsis': meta.get('description', '') or '',
            'addedAt': None,
            'series': series,
            'series_index': None,
            'rating': 0,
            'shelves': manual.get('shelves', []),
            'categories': meta.get('genres', []) or [],
            'status': status,
            'mediaType': 'audiobook',
            'currentProgress': progress,
            'totalTime': total_time,
            'startDate': _abs_ts(prog.get('startedAt')) if prog else None,
            'endDate': _abs_ts(prog.get('finishedAt')) if prog else None,
            'timesStartedReading': 0,
            'source': 'audiobookshelf',
        }
        entry.update({k: v for k, v in manual.items()
                      if k not in ('status', 'currentProgress', 'totalTime', 'shelves')})
        books_data.append(entry)


# Fields the old Firebase app tracks that CWA has no equivalent for. Firebase is the
# sole source for these (unlike Audiobookshelf's KoboReadingState, nothing else in
# this app writes them), so every sync just overwrites them - "last sync wins".
_FIREBASE_SYNCED_FIELDS = ('rating', 'review', 'favorite', 'mediaType', 'totalPages',
                           'totalTime', 'feelings', 'categories', 'startDate', 'endDate')


def _merge_firebase_legacy(books_data, manual_books, shelf_name_to_id):
    # shelf_name_to_id: this user's real ub.Shelf rows, {name: id}. A Firebase shelf
    # with no matching local Shelf (e.g. created there after the one-time import ran)
    # is skipped here - get_data() is a read path and shouldn't be creating rows;
    # re-running the one-time import picks up new shelves too.
    fb_books, fb_shelves, _fb_profile = firebase_legacy.fetch_snapshot()
    if not fb_books:
        return

    calibre_index = {_norm(b['title']): b for b in books_data}
    shelf_membership = {}  # firebase book id -> set of local shelf id strings
    for fb_shelf in fb_shelves:
        shelf_id = shelf_name_to_id.get(fb_shelf.get('name'))
        if shelf_id is None:
            continue
        for fb_book_id in fb_shelf.get('bookOrder', []):
            shelf_membership.setdefault(fb_book_id, set()).add(str(shelf_id))

    for fb in fb_books:
        fb_id = fb.get('id')
        title = fb.get('title', '')
        status = fb.get('status')
        synced = {k: fb[k] for k in _FIREBASE_SYNCED_FIELDS if fb.get(k) not in (None, '')}

        match = calibre_index.get(_norm(title))
        if match is not None:
            match['hasFirebaseEntry'] = True
            if status and _STATUS_RANK.get(status, 0) > _STATUS_RANK.get(match['status'], 0):
                match['status'] = status
            match.update(synced)
            continue

        # No matching Calibre book - same "fb:<id>" card the one-time import (if run)
        # created. Firebase is authoritative for its own fields (always overwritten
        # below); shelves are unioned with any local-only assignment so an in-app
        # drag-to-shelf here never gets silently undone by the next sync.
        virtual_id = 'fb:{}'.format(fb_id)
        local = manual_books.get(virtual_id, {})
        local_shelves = set(local.get('shelves', []))
        entry = dict(synced,
                     id=virtual_id,
                     title=title,
                     author=fb.get('author', ''),
                     coverUrl=fb.get('coverUrl', ''),
                     synopsis=fb.get('synopsis', ''),
                     addedAt=fb.get('addedAt'),
                     status=status or local.get('status', 'quero-ler'),
                     currentProgress=fb.get('currentProgress', local.get('currentProgress', 0)),
                     shelves=sorted(local_shelves | shelf_membership.get(fb_id, set())),
                     source='firebase-legacy')
        books_data.append(entry)


@bookshelf.route('/')
@login_required
def index():
    return render_template('bookshelf_app.html')


@bookshelf.route('/api/abs-cover/<item_id>')
@login_required
def abs_cover(item_id):
    # Proxies the cover through our own server so the Audiobookshelf token never
    # reaches the browser and this works even if ABS isn't reachable from the client.
    content, content_type = audiobookshelf.cover_bytes(item_id)
    if content is None:
        abort(404)
    return Response(content, mimetype=content_type)


@bookshelf.route('/api/data')
@login_required
def get_data():
    try:
        entries = calibre_db.session.query(db.Books).filter(
            calibre_db.common_filters(allow_show_archived=True)
        ).all()

        user_shelves = ub.session.query(ub.Shelf).filter(ub.Shelf.user_id == int(current_user.id)).all()
        user_shelf_ids = [s.id for s in user_shelves]
        book_shelf_mappings = ub.session.query(ub.BookShelf).filter(
            ub.BookShelf.shelf.in_(user_shelf_ids)).all() if user_shelf_ids else []
        book_shelves_map = {}
        for m in book_shelf_mappings:
            book_shelves_map.setdefault(m.book_id, []).append(str(m.shelf))

        read_entries = {rb.book_id: rb for rb in ub.session.query(ub.ReadBook).filter(
            ub.ReadBook.user_id == int(current_user.id)).all()}

        kobo_states = {ks.book_id: ks for ks in ub.session.query(ub.KoboReadingState).filter(
            ub.KoboReadingState.user_id == int(current_user.id)).all()}

        manual_books = _manual_books()

        books_data = []
        for book in entries:
            rb = read_entries.get(book.id)
            manual = manual_books.get(str(book.id), {})

            auto_status = STATUS_MAP.get(rb.read_status, 'quero-ler') if rb else 'quero-ler'
            status = manual.get('status', auto_status)

            progress = 0.0
            ks = kobo_states.get(book.id)
            if ks is not None and ks.current_bookmark is not None and ks.current_bookmark.progress_percent is not None:
                progress = ks.current_bookmark.progress_percent
            if status == 'lido':
                progress = 1.0
            progress = manual.get('currentProgress', progress)

            entry = {
                'id': book.id,
                'title': book.title,
                'author': book.author_sort,
                'coverUrl': url_for('web.get_cover', book_id=book.id),
                'synopsis': book.comments[0].text if book.comments else "",
                'addedAt': book.timestamp.isoformat() if book.timestamp else None,
                'series': book.series[0].name if book.series else "",
                'series_index': book.series_index,
                'rating': int(book.ratings[0].rating / 2) if book.ratings else 0,  # Calibre is 0-10
                'shelves': book_shelves_map.get(book.id, []),
                'categories': [t.name for t in book.tags] if book.tags else [],
                'status': status,
                'currentProgress': progress,
                'startDate': rb.last_time_started_reading.isoformat() if rb and rb.last_time_started_reading else None,
                'endDate': rb.last_modified.isoformat() if rb and rb.read_status == ub.ReadBook.STATUS_FINISHED else None,
                'timesStartedReading': rb.times_started_reading if rb else 0,
            }
            # Manual overrides (dates, notes, review, bookType, personal rating, "abandonado", ...)
            entry.update({k: v for k, v in manual.items() if k not in ('status', 'currentProgress')})
            books_data.append(entry)

        _merge_audiobookshelf(books_data, manual_books)
        _merge_firebase_legacy(books_data, manual_books, {s.name: s.id for s in user_shelves})

        shelves_data = [{'id': s.id, 'name': s.name, 'is_public': s.is_public} for s in user_shelves]

        profile_ns = _bookshelf_ns()
        user_settings = {
            'theme': profile_ns.get('theme', 'dark'),
            'avatarUrl': profile_ns.get('avatar'),
            'name': current_user.name,
            'pronouns': profile_ns.get('pronouns', ''),
            'blog': profile_ns.get('blog', ''),
            'instagram': profile_ns.get('instagram', ''),
            'youtube': profile_ns.get('youtube', ''),
            'lidoOrder': profile_ns.get('lidoOrder', []),
            'lendoOrder': profile_ns.get('lendoOrder', []),
            'quero-lerOrder': profile_ns.get('quero-lerOrder', []),
            'abandonadoOrder': profile_ns.get('abandonadoOrder', []),
        }

        return jsonify({
            "status": "success",
            "data": {
                "books": books_data,
                "shelves": shelves_data,
                "profile": user_settings
            }
        })
    except Exception as e:
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500


@bookshelf.route('/api/save', methods=['POST'])
@login_required
def api_save():
    try:
        req = request.get_json()
        coll = req.get('collection')
        data = req.get('data', {})
        obj_id = req.get('id')

        if coll == 'books':
            if not obj_id:
                return jsonify({"status": "error", "message": "Book creation requires Calibre"}), 501

            # Virtual cards ("abs:<id>" from Audiobookshelf, "fb:<id>" from the legacy
            # Firebase import/sync) have no Calibre book_id to hang ReadBook/BookShelf
            # rows off of, so everything about them lives in view_settings instead.
            is_virtual = isinstance(obj_id, str) and (obj_id.startswith('abs:') or obj_id.startswith('fb:'))
            manual_fields = {k: v for k, v in data.items() if k != 'shelves'}
            status = manual_fields.get('status')

            if is_virtual:
                key = obj_id
            else:
                book_id = int(obj_id)
                key = str(book_id)
                rb = _get_or_create_read_book(book_id)
                if status:
                    _apply_native_status(rb, status)

            books = _manual_books()
            entry = books.get(key, {})
            entry.update(manual_fields)

            if 'shelves' in data:
                if is_virtual:
                    entry['shelves'] = data['shelves']
                else:
                    new_shelf_ids = [int(sid) for sid in data['shelves']]
                    user_shelves = ub.session.query(ub.Shelf).filter_by(user_id=current_user.id).all()
                    user_shelf_ids = [s.id for s in user_shelves]
                    ub.session.query(ub.BookShelf).filter(
                        ub.BookShelf.book_id == book_id,
                        ub.BookShelf.shelf.in_(user_shelf_ids)
                    ).delete(synchronize_session=False)
                    for sid in new_shelf_ids:
                        if sid in user_shelf_ids:
                            ub.session.add(ub.BookShelf(book_id=book_id, shelf=sid))

            books[key] = entry
            current_user.set_view_property('bookshelf', 'books', books)

        elif coll == 'shelves':
            shelf_id = int(obj_id) if obj_id else None
            if shelf_id:
                shelf = ub.session.query(ub.Shelf).filter_by(id=shelf_id, user_id=current_user.id).first()
                if shelf:
                    shelf.name = data.get('name', shelf.name)
            else:
                new_shelf = ub.Shelf(name=data.get('name', 'Nova Estante'), user_id=current_user.id)
                ub.session.add(new_shelf)
                ub.session.flush()
                obj_id = new_shelf.id

        elif coll == 'profile' or coll == 'profile_data':
            for k, v in data.items():
                current_user.set_view_property('bookshelf', k, v)

        elif coll == 'shelves_order':
            current_user.set_view_property('bookshelf', 'shelvesOrder', data.get('orderedIds', []))

        elif coll == 'book_order':
            shelf_id = data.get('shelfId')
            orderedIds = data.get('orderedBookIds', [])
            current_user.set_view_property('bookshelf', f'shelf_{shelf_id}_order', orderedIds)

        elif coll == 'add_to_shelf':
            shelf_id = int(data.get('shelfId'))
            book_ids = [int(bid) for bid in data.get('bookIds', [])]
            for bid in book_ids:
                exists = ub.session.query(ub.BookShelf).filter_by(book_id=bid, shelf=shelf_id).first()
                if not exists:
                    ub.session.add(ub.BookShelf(book_id=bid, shelf=shelf_id))

        ub.session_commit()
        return jsonify({"status": "success", "id": obj_id})
    except Exception as e:
        ub.session.rollback()
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500


@bookshelf.route('/api/delete', methods=['POST'])
@login_required
def api_delete():
    try:
        req = request.get_json()
        coll = req.get('collection')
        obj_id = req.get('id')

        if coll == 'books':
            is_virtual = isinstance(obj_id, str) and (obj_id.startswith('abs:') or obj_id.startswith('fb:'))
            key = obj_id if is_virtual else str(int(obj_id))
            if not is_virtual:
                ub.session.query(ub.ReadBook).filter_by(user_id=current_user.id, book_id=int(obj_id)).delete()
            books = _manual_books()
            books.pop(key, None)
            current_user.set_view_property('bookshelf', 'books', books)

        elif coll == 'shelves':
            shelf_id = int(obj_id)
            ub.session.query(ub.Shelf).filter_by(id=shelf_id, user_id=current_user.id).delete()
            ub.session.query(ub.BookShelf).filter_by(shelf=shelf_id).delete()

        elif coll == 'all_books':
            ub.session.query(ub.ReadBook).filter_by(user_id=current_user.id).delete()
            current_user.set_view_property('bookshelf', 'books', {})

        elif coll == 'remove_from_shelf':
            book_id = int(obj_id.get('bookId'))
            shelf_id = int(obj_id.get('shelfId'))
            ub.session.query(ub.BookShelf).filter_by(book_id=book_id, shelf=shelf_id).delete()

        ub.session_commit()
        return jsonify({"status": "success"})
    except Exception as e:
        ub.session.rollback()
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500


@bookshelf.route('/api/import', methods=['POST'])
@login_required
def api_import():
    try:
        req = request.get_json()
        books = req.get('books', [])
        count = 0
        for b in books:
            title = b.get('title')
            match = calibre_db.session.query(db.Books).filter(db.Books.title == title).first()
            if match:
                status = b.get('status', 'lido')
                rb = _get_or_create_read_book(match.id)
                _apply_native_status(rb, status)

                books = _manual_books()
                entry = books.get(str(match.id), {})
                entry['status'] = status
                if b.get('endDate'):
                    entry['endDate'] = b.get('endDate')
                if b.get('rating'):
                    entry['rating'] = b.get('rating')
                if b.get('review'):
                    entry['review'] = b.get('review')
                books[str(match.id)] = entry
                current_user.set_view_property('bookshelf', 'books', books)
                count += 1
        ub.session_commit()
        return jsonify({"status": "success", "count": count})
    except Exception as e:
        ub.session.rollback()
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500


# One-time migration path from the original standalone Bookshelf app (Firebase/
# Firestore), for people who used it before this project existed. Books are matched
# to Calibre by normalized title; unmatched ones (the majority for most people, since
# a personal reading log usually includes physical books) become "fb:<id>" virtual
# cards, same treatment as unmatched Audiobookshelf items - everything about them
# (status, dates, review, personal rating, cover, synopsis, shelves) lives in
# view_settings since there's no Calibre book_id to hang a real ReadBook/BookShelf row
# on. Firebase-only fields (rating 0-5, review, favorite, mediaType, totalPages,
# totalTime, feelings) have no CWA equivalent regardless of match, so those always go
# into the manual override too.
_FIREBASE_MANUAL_FIELDS = ('rating', 'review', 'favorite', 'mediaType', 'totalPages',
                           'totalTime', 'feelings', 'categories')


def _clean_isbn(raw):
    # Firestore data here was itself once imported from a Goodreads/Excel CSV export,
    # which wraps ISBNs like ="9781444951400" to force text formatting.
    if not raw:
        return ''
    return raw.replace('="', '').replace('"', '').strip()


@bookshelf.route('/api/import_firebase', methods=['POST'])
@login_required
def import_firebase():
    try:
        req = request.get_json()
        fb_books = req.get('books', [])
        fb_shelves = req.get('shelves', [])
        fb_profile = req.get('profile', {})

        calibre_index = {}
        for b in calibre_db.session.query(db.Books).all():
            calibre_index.setdefault(_norm(b.title), b)

        manual_books = _manual_books()
        id_map = {}  # firebase book id -> our book id (int for a Calibre match, else "fb:<id>")
        matched_count = 0
        virtual_count = 0

        for fb in fb_books:
            fb_id = fb.get('id')
            if not fb_id:
                continue
            title = fb.get('title', '')
            match = calibre_index.get(_norm(title))
            status = fb.get('status')

            manual_fields = {k: fb[k] for k in _FIREBASE_MANUAL_FIELDS if fb.get(k) not in (None, '', [], 0)}
            if fb.get('startDate'):
                manual_fields['startDate'] = fb['startDate']
            if fb.get('endDate'):
                manual_fields['endDate'] = fb['endDate']
            if status:
                manual_fields['status'] = status

            if match is not None:
                key = str(match.id)
                id_map[fb_id] = match.id
                rb = _get_or_create_read_book(match.id)
                if status:
                    _apply_native_status(rb, status)
                matched_count += 1
            else:
                key = 'fb:{}'.format(fb_id)
                id_map[fb_id] = key
                manual_fields['title'] = title
                manual_fields['author'] = fb.get('author', '')
                manual_fields['coverUrl'] = fb.get('coverUrl', '')
                manual_fields['synopsis'] = fb.get('synopsis', '')
                manual_fields['isbn'] = _clean_isbn(fb.get('isbn'))
                manual_fields['addedAt'] = fb.get('addedAt')
                manual_fields['source'] = 'firebase-import'
                virtual_count += 1

            entry = manual_books.get(key, {})
            entry.update(manual_fields)
            manual_books[key] = entry

        shelf_count = 0
        existing_shelf_by_name = {s.name: s.id for s in
                                  ub.session.query(ub.Shelf).filter_by(user_id=current_user.id).all()}
        for fb_shelf in fb_shelves:
            name = fb_shelf.get('name') or 'Estante Importada'
            if name not in existing_shelf_by_name:
                new_shelf = ub.Shelf(name=name, user_id=current_user.id)
                ub.session.add(new_shelf)
                ub.session.flush()
                existing_shelf_by_name[name] = new_shelf.id
            shelf_id = existing_shelf_by_name[name]
            shelf_count += 1

            for fb_book_id in fb_shelf.get('bookOrder', []):
                mapped = id_map.get(fb_book_id)
                if mapped is None:
                    continue
                if isinstance(mapped, int):
                    exists = ub.session.query(ub.BookShelf).filter_by(book_id=mapped, shelf=shelf_id).first()
                    if not exists:
                        ub.session.add(ub.BookShelf(book_id=mapped, shelf=shelf_id))
                else:
                    entry = manual_books.get(mapped, {})
                    shelf_ids = entry.get('shelves', [])
                    if str(shelf_id) not in shelf_ids:
                        shelf_ids.append(str(shelf_id))
                    entry['shelves'] = shelf_ids
                    manual_books[mapped] = entry

        current_user.set_view_property('bookshelf', 'books', manual_books)

        for k in ('name', 'pronouns', 'blog', 'instagram', 'youtube', 'theme'):
            if fb_profile.get(k):
                current_user.set_view_property('bookshelf', k, fb_profile[k])
        for order_key in ('lidoOrder', 'lendoOrder', 'quero-lerOrder', 'abandonadoOrder'):
            mapped_order = [str(id_map[fid]) for fid in fb_profile.get(order_key, []) if fid in id_map]
            if mapped_order:
                current_user.set_view_property('bookshelf', order_key, mapped_order)

        ub.session_commit()
        return jsonify({
            "status": "success",
            "matched": matched_count,
            "virtual": virtual_count,
            "shelves": shelf_count,
        })
    except Exception as e:
        ub.session.rollback()
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500


@bookshelf.route('/api/avatar', methods=['POST'])
@login_required
def upload_avatar():
    try:
        if 'avatar' not in request.files:
            return jsonify({"status": "error", "message": "No file part"}), 400
        file = request.files['avatar']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No selected file"}), 400
        if file:
            filename = f"user_{current_user.id}_avatar{os.path.splitext(file.filename)[1]}"
            static_folder = os.path.join(bookshelf.static_folder, 'avatars')
            if not os.path.exists(static_folder):
                os.makedirs(static_folder)
            filepath = os.path.join(static_folder, filename)
            file.save(filepath)
            avatar_url = url_for('bookshelf.static', filename=f"avatars/{filename}")
            current_user.set_view_property('bookshelf', 'avatar', avatar_url)
            ub.session_commit()
            return jsonify({"status": "success", "avatar_url": avatar_url})
    except Exception as e:
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500
