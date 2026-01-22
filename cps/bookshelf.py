from flask import Blueprint, render_template, abort, send_from_directory, request, jsonify, url_for
# Bookshelf Integration - Refined and Localized
from flask_login import login_required, current_user
import os
from . import ub, db, calibre_db, logger

bookshelf = Blueprint('bookshelf', __name__, 
                     url_prefix='/bookshelf',
                     template_folder='templates/bookshelf',
                     static_folder='static/bookshelf')

log = logger.create()

@bookshelf.route('/')
@login_required
def index():
    # Serve the main Bookshelf app
    return render_template('bookshelf_app.html')

@bookshelf.route('/api/data')
@login_required
def get_data():
    try:
        # Get all books for the user
        entries = calibre_db.session.query(db.Books).filter(
            calibre_db.common_filters(allow_show_archived=True)
        ).all()

        # Get all book/shelf mapping for the current user
        user_shelves = ub.session.query(ub.Shelf).filter(ub.Shelf.user_id == int(current_user.id)).all()
        user_shelf_ids = [s.id for s in user_shelves]
        book_shelf_mappings = ub.session.query(ub.BookShelf).filter(ub.BookShelf.shelf.in_(user_shelf_ids)).all()
        book_shelves_map = {}
        for m in book_shelf_mappings:
            if m.book_id not in book_shelves_map:
                book_shelves_map[m.book_id] = []
            book_shelves_map[m.book_id].append(str(m.shelf))

        books_data = []
        for book in entries:
            cover_url = url_for('web.get_cover', book_id=book.id)
            books_data.append({
                'id': book.id,
                'title': book.title,
                'author': book.author_sort,
                'coverUrl': cover_url,
                'synopsis': book.comments[0].text if book.comments else "",
                'addedAt': book.timestamp.isoformat() if book.timestamp else None,
                'series': book.series[0].name if book.series else "",
                'series_index': book.series_index,
                'rating': int(book.ratings[0].rating / 2) if book.ratings else 0, # Calibre is 0-10
                'shelves': book_shelves_map.get(book.id, []),
                'categories': [t.name for t in book.tags] if book.tags else []
            })

        # Get reading progress
        progress_entries = ub.session.query(ub.ReadingProgress).filter(
            ub.ReadingProgress.user_id == int(current_user.id)
        ).all()
        
        # Get reading status
        read_book_entries = ub.session.query(ub.ReadBook).filter(
            ub.ReadBook.user_id == int(current_user.id)
        ).all()
        
        progress_data = {}
        for rb in read_book_entries:
            status_str = 'quero-ler'
            if rb.read_status == ub.ReadBook.STATUS_FINISHED: status_str = 'lido'
            elif rb.read_status == ub.ReadBook.STATUS_IN_PROGRESS: status_str = 'lendo'
                
            progress_data[rb.book_id] = {
                'percent': 1.0 if status_str == 'lido' else 0,
                'data': {'status': status_str}
            }

        for p in progress_entries:
            if p.book_id in progress_data:
                progress_data[p.book_id]['percent'] = p.progress_percent
                if p.data: progress_data[p.book_id]['data'].update(p.data)
            else:
                progress_data[p.book_id] = {
                    'percent': p.progress_percent,
                    'data': p.data or {'status': 'quero-ler'}
                }

        # Flatten progress into books_data
        for book in books_data:
            book_id = book['id']
            if book_id in progress_data:
                prog = progress_data[book_id]
                if 'data' in prog and prog['data']:
                    book_meta = {k: v for k, v in prog['data'].items() if k != 'id'}
                    book.update(book_meta)
                book['currentProgress'] = prog.get('percent', 0)
            else:
                book['status'] = 'quero-ler'

        # Get shelves
        shelves = ub.session.query(ub.Shelf).filter(
            ub.Shelf.user_id == int(current_user.id)
        ).all()
        
        shelves_data = []
        for shelf in shelves:
            shelves_data.append({
                'id': shelf.id,
                'name': shelf.name,
                'is_public': shelf.is_public
            })

        # Get user profile/theme settings
        user_settings = {
            'theme': current_user.view_settings.get('bookshelf', {}).get('theme', 'fauno'),
            'avatarUrl': current_user.view_settings.get('bookshelf', {}).get('avatar', None),
            'name': current_user.name,
            'lidoOrder': current_user.view_settings.get('bookshelf', {}).get('lidoOrder', []),
            'lendoOrder': current_user.view_settings.get('bookshelf', {}).get('lendoOrder', []),
            'quero-lerOrder': current_user.view_settings.get('bookshelf', {}).get('quero-lerOrder', []),
            'abandonadoOrder': current_user.view_settings.get('bookshelf', {}).get('abandonadoOrder', []),
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
            if not book_id: return jsonify({"status": "error", "message": "Book creation requires Calibre"}), 501
            
            rb = ub.session.query(ub.ReadBook).filter_by(user_id=current_user.id, book_id=book_id).first()
            if not rb:
                rb = ub.ReadBook(user_id=current_user.id, book_id=book_id)
                ub.session.add(rb)
            
            status = data.get('status')
            if status == 'lido': rb.read_status = ub.ReadBook.STATUS_FINISHED
            elif status == 'lendo': rb.read_status = ub.ReadBook.STATUS_IN_PROGRESS
            elif status == 'quero-ler': rb.read_status = ub.ReadBook.STATUS_UNREAD
            
            rp = ub.session.query(ub.ReadingProgress).filter_by(user_id=current_user.id, book_id=book_id).first()
            if not rp:
                rp = ub.ReadingProgress(user_id=current_user.id, book_id=book_id)
                ub.session.add(rp)
            
            rp_data = dict(rp.data) if rp.data else {}
            rp_data.update(data)
            rp.data = rp_data
            if 'currentProgress' in data: rp.progress_percent = float(data['currentProgress'])
            
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
                if shelf: shelf.name = data.get('name', shelf.name)
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
                # Avoid duplicates
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
            ub.session.query(ub.ReadingProgress).filter_by(user_id=current_user.id, book_id=book_id).delete()
        
        elif coll == 'shelves':
            shelf_id = int(obj_id)
            ub.session.query(ub.Shelf).filter_by(id=shelf_id, user_id=current_user.id).delete()
            ub.session.query(ub.BookShelf).filter_by(shelf=shelf_id).delete()
            
        elif coll == 'all_books':
            ub.session.query(ub.ReadBook).filter_by(user_id=current_user.id).delete()
            ub.session.query(ub.ReadingProgress).filter_by(user_id=current_user.id).delete()
            
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
                rb = ub.session.query(ub.ReadBook).filter_by(user_id=current_user.id, book_id=match.id).first()
                if not rb:
                    rb = ub.ReadBook(user_id=current_user.id, book_id=match.id)
                    ub.session.add(rb)
                if status == 'lido': rb.read_status = ub.ReadBook.STATUS_FINISHED
                elif status == 'lendo': rb.read_status = ub.ReadBook.STATUS_IN_PROGRESS
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
