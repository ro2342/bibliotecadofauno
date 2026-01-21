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
        # This mirrors querying logic from web.py or shelf.py
        entries = calibre_db.session.query(db.Books).filter(
            calibre_db.common_filters(allow_show_archived=True)
        ).all()

        books_data = []
        for book in entries:
            cover_url = url_for('web.get_cover', book_id=book.id)
            books_data.append({
                'id': book.id,
                'title': book.title,
                'author': book.author_sort, # or authors[0]
                'cover': cover_url,
                'series': book.series[0].name if book.series else "",
                'series_index': book.series_index,
                # Add more fields as needed by Bookshelf
            })


        # Get reading progress
        progress_entries = ub.session.query(ub.ReadingProgress).filter(
            ub.ReadingProgress.user_id == int(current_user.id)
        ).all()
        
        progress_data = {}
        for p in progress_entries:
            progress_data[p.book_id] = {
                'percent': p.progress_percent,
                'location': p.location,
                'last_modified': p.last_modified.isoformat() if p.last_modified else None,
                'data': p.data  # Include the extra metadata (status, rating, etc.)
            }

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
            'theme': current_user.view_settings.get('theme', 'dark') if current_user.view_settings else 'dark',
            'avatar': current_user.view_settings.get('avatar', None) if current_user.view_settings else None,
            'name': current_user.name
        }

        return jsonify({
            "status": "success",
            "books": books_data,
            "progress": progress_data,
            "shelves": shelves_data,
            "user": user_settings
        })
    except Exception as e:
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500

@bookshelf.route('/api/profile', methods=['POST'])
@login_required
def update_profile():
    try:
        data = request.get_json()
        if 'theme' in data:
            # Use 'bookshelf' as the "page" key for view_settings
            current_user.set_view_property('bookshelf', 'theme', data['theme'])
        return jsonify({"status": "success"})
    except Exception as e:
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
            # Save file
            filename = f"user_{current_user.id}_avatar{os.path.splitext(file.filename)[1]}"
            static_folder = os.path.join(bookshelf.root_path, 'static', 'bookshelf', 'avatars')
            if not os.path.exists(static_folder):
                os.makedirs(static_folder)
            
            filepath = os.path.join(static_folder, filename)
            file.save(filepath)
            
            # Save reference in user profile
            # URL will be /static/bookshelf/avatars/filename
            avatar_url = url_for('bookshelf.static', filename=f"bookshelf/avatars/{filename}")
            current_user.set_view_property('bookshelf', 'avatar', slider_value=None) # Hack to use set_view_property or just update dict directly if key logic differs
            
            # Re-implementing set logic here directly to ensure it saves correct URL
            if not current_user.view_settings.get('bookshelf'):
                 current_user.view_settings['bookshelf'] = {}
            current_user.view_settings['bookshelf']['avatar'] = avatar_url
            ub.session_commit()
            
            return jsonify({"status": "success", "avatar_url": avatar_url})
    except Exception as e:
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500

@bookshelf.route('/api/book', methods=['POST'])
@login_required
def save_book():
    try:
        data = request.get_json()
        book_id = data.get('id')
        
        # If no ID, we theoretically create a new book. 
        # For now, we only support updating existing books in Calibre-Web
        # because creating a book requires file handling logic similar to 'editbook.py'
        if not book_id:
             return jsonify({"status": "error", "message": "Creating new books not yet supported. Please add to Calibre first."}), 501

        # 1. Update Core Book Data (Rating, etc) if allowed
        # Note: Calibre-Web usually relies on 'calibre_db' methods to update metadata safely
        # We will update Rating in the Books table if changed
        
        book = calibre_db.session.query(db.Books).filter(db.Books.id == book_id).first()
        if not book:
             return jsonify({"status": "error", "message": "Book not found"}), 404

        # Update Rating
        if 'rating' in data:
            # Calibre ratings are 1-10 (integers) or 1-5? Usually stored as 2x int in some apps, but Calibre is 1-5 stars * 2 = 2-10 integers.
            # Calibre-Web uses `ub.session` for ratings? No, it uses the Calibre DB 'books' table 'rating' column (if linked) 
            # OR 'ratings' table.
            # Let's check how Calibre-Web handles ratings. Usually it's in the 'ratings' table linked to 'books'.
            # Simpler: We store the rating in our 'ReadingProgress' data for this user, 
            # to avoid messing with the global Calibre library rating which is shared for all users.
            pass

        # 2. Update Reading Progress & Metadata (stored in ReadingProgress table)
        progress = ub.session.query(ub.ReadingProgress).filter(
            ub.ReadingProgress.user_id == int(current_user.id),
            ub.ReadingProgress.book_id == book_id
        ).first()

        if not progress:
            progress = ub.ReadingProgress(user_id=int(current_user.id), book_id=book_id)
            ub.session.add(progress)
        
        # Map fields to ReadingProgress
        status_map = {'quero-ler': 0, 'lido': 1, 'lendo': 2, 'abandonado': 3} # Example mapping, adjust as needed
        # Actually ReadingProgress has its own columns.
        # Let's treat 'status' from Bookshelf as a string in 'data' JSON if needed, 
        # or map to ReadBook table if we want to integrate with Calibre-Web's "Have Read" status.
        
        # Calibre-Web's native "Read" status is in 'book_read_link' table (ReadBook model).
        # We should align with that for 'lido' vs 'nav'.
        
        read_status_entry = ub.session.query(ub.ReadBook).filter(
            ub.ReadBook.user_id == int(current_user.id),
            ub.ReadBook.book_id == book_id
        ).first()

        if not read_status_entry:
            read_status_entry = ub.ReadBook(user_id=int(current_user.id), book_id=book_id)
            ub.session.add(read_status_entry)

        if data.get('status') == 'lido':
            read_status_entry.read_status = ub.ReadBook.STATUS_FINISHED
        elif data.get('status') == 'lendo':
            read_status_entry.read_status = ub.ReadBook.STATUS_IN_PROGRESS
        else:
             read_status_entry.read_status = ub.ReadBook.STATUS_UNREAD

        # Persist other metadata in ReadingProgress.data
        if not progress.data:
            progress.data = {}
        
        # Update JSON fields
        fields_to_store = ['status', 'rating', 'feelings', 'startDate', 'endDate', 
                           'mediaType', 'totalPages', 'totalTime', 'review', 'synopsis', 'favorite', 'coverUrl']
        
        # Make a copy of current data to avoid mutation issues if any
        new_data = dict(progress.data) if progress.data else {}
        for field in fields_to_store:
            if field in data:
                new_data[field] = data[field]
        
        progress.data = new_data
        
        # Update shelves
        if 'shelves' in data:
            # clear existing shelf links for this book/user
            # Wait, BookShelf table links book_id -> shelf_id.
            # We need to find shelves belonging to this user and unmark them if not in list.
            
            # Get all shelves for this user
            user_shelves = ub.session.query(ub.Shelf).filter(ub.Shelf.user_id == int(current_user.id)).all()
            user_shelf_ids = [s.id for s in user_shelves]
            
            # Current links
            current_links = ub.session.query(ub.BookShelf).filter(
                ub.BookShelf.book_id == book_id,
                ub.BookShelf.shelf.in_(user_shelf_ids)
            ).all()
            
            # Remove links not in new list
            new_shelf_ids = [int(s) for s in data['shelves']]
            for link in current_links:
                if link.shelf not in new_shelf_ids:
                    ub.session.delete(link)
            
            # Add new links
            current_linked_shelf_ids = [link.shelf for link in current_links]
            for sid in new_shelf_ids:
                if sid not in current_linked_shelf_ids and sid in user_shelf_ids:
                    new_link = ub.BookShelf(book_id=book_id, shelf=sid)
                    ub.session.add(new_link)

        ub.session_commit()
        return jsonify({"status": "success", "id": book_id})

    except Exception as e:
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500

@bookshelf.route('/api/book/delete', methods=['POST'])
@login_required
def delete_book():
    # Only remove from user's view (reading progress / shelves) OR delete file if admin?
    # Bookshelf app implies "delete from my library".
    # For now, we will just remove the ReadingProgress and ReadBook entries, effectively "resetting" it for the user.
    # We will NOT delete the actual book from Calibre database to avoid data loss for other users.
    try:
        data = request.get_json()
        book_id = data.get('id')
        
        ub.session.query(ub.ReadingProgress).filter(
            ub.ReadingProgress.user_id == int(current_user.id),
            ub.ReadingProgress.book_id == book_id
        ).delete()
        
        ub.session.query(ub.ReadBook).filter(
             ub.ReadBook.user_id == int(current_user.id),
             ub.ReadBook.book_id == book_id
        ).delete()
        
        # Handle shelf links removal
        # Find shelves for this user
        user_shelves = ub.session.query(ub.Shelf).filter(ub.Shelf.user_id == int(current_user.id)).all()
        user_shelf_ids = [s.id for s in user_shelves]
        
        if user_shelf_ids:
            ub.session.query(ub.BookShelf).filter(
                ub.BookShelf.book_id == book_id,
                ub.BookShelf.shelf.in_(user_shelf_ids)
            ).delete(synchronize_session=False)

        ub.session_commit()
        return jsonify({"status": "success"})
    except Exception as e:
        log.error_or_exception(e)
        return jsonify({"status": "error", "message": str(e)}), 500
