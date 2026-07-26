from flask import Blueprint, render_template, request, jsonify, url_for
# Bookshelf Integration - ported onto calibre-web-automated.
# Reading status/progress is read from and written back to CWA's own tables
# (ReadBook, KoboReadingState/KoboBookmark) so Kobo/KOReader sync and the
# Bookshelf UI stay in sync automatically. Fields CWA has no concept of
# (personal notes, manual dates, "abandonado" status, review text, etc.) are
# stored in current_user.view_settings['bookshelf'], which already exists on
# every user row - no new tables/migrations needed.
from flask_login import login_required, current_user
import os
from datetime import datetime, timezone
from . import ub, db, calibre_db, logger

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


@bookshelf.route('/')
@login_required
def index():
    return render_template('bookshelf_app.html')


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

        shelves_data = [{'id': s.id, 'name': s.name, 'is_public': s.is_public} for s in user_shelves]

        profile_ns = _bookshelf_ns()
        user_settings = {
            'theme': profile_ns.get('theme', 'fauno'),
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
            book_id = int(obj_id) if obj_id else None
            if not book_id:
                return jsonify({"status": "error", "message": "Book creation requires Calibre"}), 501

            rb = _get_or_create_read_book(book_id)

            manual_fields = {k: v for k, v in data.items() if k != 'shelves'}
            status = manual_fields.get('status')
            if status:
                _apply_native_status(rb, status)

            books = _manual_books()
            entry = books.get(str(book_id), {})
            entry.update(manual_fields)
            books[str(book_id)] = entry
            current_user.set_view_property('bookshelf', 'books', books)

            if 'shelves' in data:
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
            book_id = int(obj_id)
            ub.session.query(ub.ReadBook).filter_by(user_id=current_user.id, book_id=book_id).delete()
            books = _manual_books()
            books.pop(str(book_id), None)
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
