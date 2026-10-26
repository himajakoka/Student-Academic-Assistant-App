"""
College Event Management Portal - Flask Application
A full-stack, responsive, centralized platform for university event discovery,
student registration, and organizer event management.
"""

import os
import re
import csv
import io
import uuid
from datetime import datetime, date
from functools import wraps

from flask import (
    Flask, render_template, request, jsonify, session,
    redirect, url_for, flash, make_response, g
)
from werkzeug.security import check_password_hash, generate_password_hash
from database import get_db, init_db

# Initialize Flask application
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'presidency-bca-event-portal-secret-key-2026')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 7200  # 2 hours

# Initialize database schema and seed data on startup
with app.app_context():
    init_db()


# ---------------------------------------------------------
# Database Connection Lifecycle
# ---------------------------------------------------------
@app.before_request
def before_request():
    g.db = get_db()


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


# ---------------------------------------------------------
# Helper Functions & Decorators
# ---------------------------------------------------------
def organizer_required(f):
    """Decorator to protect organizer-only routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'organizer_id' not in session:
            if request.is_json or request.path.startswith('/api/organizer'):
                return jsonify({'success': False, 'message': 'Authentication required. Please log in.'}), 401
            flash('Please log in to access the Organizer Dashboard.', 'warning')
            return redirect(url_for('organizer_login_page', next=request.path))
        return f(*args, **kwargs)
    return decorated_function


def validate_email_format(email: str) -> bool:
    """Validate email format using regex."""
    pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return bool(re.match(pattern, email.strip()))


def get_event_with_stats(event_row):
    """Helper to convert row to dict and add registration statistics."""
    ev = dict(event_row)
    db = g.db
    # Count confirmed registrations
    cursor = db.cursor()
    cursor.execute("""
        SELECT COUNT(*) as reg_count 
        FROM registrations 
        WHERE event_id = ? AND status = 'Confirmed'
    """, (ev['id'],))
    reg_count = cursor.fetchone()['reg_count']
    
    ev['registered_count'] = reg_count
    ev['remaining_spots'] = max(0, ev['capacity'] - reg_count)
    ev['is_full'] = reg_count >= ev['capacity']
    
    # Check if event is in the past
    try:
        event_dt = datetime.strptime(f"{ev['event_date']} {ev['event_time']}", "%Y-%m-%d %H:%M")
        ev['is_past'] = event_dt < datetime.now()
    except Exception:
        ev['is_past'] = ev['event_date'] < datetime.now().strftime("%Y-%m-%d")
        
    return ev


# ---------------------------------------------------------
# Frontend Template Routes (HTML Pages)
# ---------------------------------------------------------

@app.route('/')
def home():
    """Home landing page with hero, live statistics, and upcoming events."""
    db = g.db
    cursor = db.cursor()
    today_str = datetime.now().strftime("%Y-%m-%d")

    # Fetch live counts from database
    cursor.execute("SELECT COUNT(*) as count FROM events WHERE event_date >= ?", (today_str,))
    upcoming_events_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(DISTINCT category) as count FROM events")
    categories_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM registrations WHERE status = 'Confirmed'")
    total_registrations_count = cursor.fetchone()['count']

    # Fetch top 6 upcoming events
    cursor.execute("""
        SELECT e.*, 
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'Confirmed') as registered_count
        FROM events e
        WHERE e.event_date >= ?
        ORDER BY e.event_date ASC, e.event_time ASC
        LIMIT 6
    """, (today_str,))
    upcoming_events = [get_event_with_stats(row) for row in cursor.fetchall()]

    stats = {
        'upcoming_events': upcoming_events_count,
        'categories': categories_count,
        'total_registrations': total_registrations_count,
        'departments': 8
    }

    return render_template('index.html', stats=stats, upcoming_events=upcoming_events)


@app.route('/events')
def events_page():
    """Browse events page with filter pills, search, and responsive cards."""
    category = request.args.get('category', '').strip()
    search = request.args.get('search', '').strip()
    return render_template('events.html', selected_category=category, search_query=search)


@app.route('/events/<int:event_id>')
def event_details_page(event_id):
    """Detailed view for a specific event."""
    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = cursor.fetchone()
    if not row:
        flash('The requested event could not be found.', 'danger')
        return redirect(url_for('events_page'))

    event = get_event_with_stats(row)
    return render_template('event_details.html', event=event)


@app.route('/my-registrations')
def my_registrations_page():
    """Student registration lookup & management page."""
    reg_no = request.args.get('register_number', '').strip()
    return render_template('my_registrations.html', initial_reg_no=reg_no)


@app.route('/organizer/login')
def organizer_login_page():
    """Organizer login screen."""
    if 'organizer_id' in session:
        return redirect(url_for('organizer_dashboard_page'))
    return render_template('organizer_login.html')


@app.route('/organizer/dashboard')
@organizer_required
def organizer_dashboard_page():
    """Organizer analytics and summary dashboard."""
    return render_template('organizer_dashboard.html')


@app.route('/organizer/events')
@organizer_required
def manage_events_page():
    """Organizer event management: create, edit, delete, view."""
    return render_template('manage_events.html')


@app.route('/organizer/events/<int:event_id>/participants')
@organizer_required
def event_participants_page(event_id):
    """View and export registered participants for a given event."""
    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event_row = cursor.fetchone()
    if not event_row:
        flash('Event not found.', 'danger')
        return redirect(url_for('manage_events_page'))

    event = get_event_with_stats(event_row)
    return render_template('participants.html', event=event)


# ---------------------------------------------------------
# Public & Student API Endpoints
# ---------------------------------------------------------

@app.route('/api/events', methods=['GET'])
def api_get_events():
    """
    Fetch events with optional search, category, and date filtering.
    Returns JSON list of events with live registration stats.
    """
    db = g.db
    cursor = db.cursor()

    search = request.args.get('search', '').strip()
    category = request.args.get('category', '').strip()
    status = request.args.get('status', 'upcoming').strip()
    today_str = datetime.now().strftime("%Y-%m-%d")

    query = "SELECT * FROM events WHERE 1=1"
    params = []

    if status == 'upcoming':
        query += " AND event_date >= ?"
        params.append(today_str)
    elif status == 'past':
        query += " AND event_date < ?"
        params.append(today_str)

    if category and category.lower() != 'all':
        query += " AND LOWER(category) = LOWER(?)"
        params.append(category)

    if search:
        query += " AND (title LIKE ? OR description LIKE ? OR venue LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    query += " ORDER BY event_date ASC, event_time ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    events_list = [get_event_with_stats(row) for row in rows]

    return jsonify({
        'success': True,
        'message': f'Found {len(events_list)} events.',
        'data': events_list
    })


@app.route('/api/events/<int:event_id>', methods=['GET'])
def api_get_single_event(event_id):
    """Fetch details and stats for a single event."""
    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({'success': False, 'message': 'Event not found.'}), 404

    event = get_event_with_stats(row)
    return jsonify({
        'success': True,
        'message': 'Event details retrieved successfully.',
        'data': event
    })


@app.route('/api/register', methods=['POST'])
def api_register_student():
    """
    Register a student for an event.
    Performs server-side validation, duplicate prevention, and capacity checks.
    """
    data = request.get_json() or {}
    event_id = data.get('event_id')
    student_name = (data.get('student_name') or '').strip()
    student_email = (data.get('student_email') or '').strip().lower()
    student_register_number = (data.get('student_register_number') or '').strip().upper()

    # 1. Field presence validation
    if not event_id:
        return jsonify({'success': False, 'message': 'Event ID is required.'}), 400
    if not student_name or len(student_name) < 2:
        return jsonify({'success': False, 'message': 'Please provide a valid full name (minimum 2 characters).'}), 400
    if not student_email or not validate_email_format(student_email):
        return jsonify({'success': False, 'message': 'Please enter a valid college or personal email address.'}), 400
    if not student_register_number or len(student_register_number) < 4:
        return jsonify({'success': False, 'message': 'Please enter a valid student register number (e.g., 2024BCA014).'}), 400

    db = g.db
    cursor = db.cursor()

    # 2. Check if event exists
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event_row = cursor.fetchone()
    if not event_row:
        return jsonify({'success': False, 'message': 'The selected event does not exist.'}), 404

    event = get_event_with_stats(event_row)

    # 3. Check if event has already passed
    if event['is_past']:
        return jsonify({'success': False, 'message': 'Registration is closed because this event has already taken place.'}), 400

    # 4. Check if event is at full capacity
    if event['is_full']:
        return jsonify({'success': False, 'message': f"Registration closed: '{event['title']}' has reached full capacity ({event['capacity']} participants)."}), 400

    # 5. Check duplicate registration
    cursor.execute("""
        SELECT id, registration_id, status 
        FROM registrations 
        WHERE event_id = ? AND student_register_number = ?
    """, (event_id, student_register_number))
    existing_reg = cursor.fetchone()

    if existing_reg:
        if existing_reg['status'] == 'Confirmed':
            return jsonify({
                'success': False,
                'message': f"Duplicate registration! Register Number '{student_register_number}' is already registered for this event with ID: {existing_reg['registration_id']}."
            }), 409
        elif existing_reg['status'] == 'Cancelled':
            # Re-activate previously cancelled registration
            new_reg_id = f"REG-2026-{uuid.uuid4().hex[:6].upper()}"
            cursor.execute("""
                UPDATE registrations 
                SET registration_id = ?, student_name = ?, student_email = ?, status = 'Confirmed', registered_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (new_reg_id, student_name, student_email, existing_reg['id']))
            db.commit()
            return jsonify({
                'success': True,
                'message': 'Your registration has been reactivated successfully!',
                'data': {
                    'registration_id': new_reg_id,
                    'event_title': event['title'],
                    'event_date': event['event_date'],
                    'event_time': event['event_time'],
                    'venue': event['venue'],
                    'student_name': student_name,
                    'student_register_number': student_register_number
                }
            }), 201

    # 6. Generate unique Registration Reference ID
    unique_reg_id = f"REG-2026-{uuid.uuid4().hex[:6].upper()}"

    try:
        cursor.execute("""
            INSERT INTO registrations (registration_id, event_id, student_name, student_email, student_register_number, status)
            VALUES (?, ?, ?, ?, ?, 'Confirmed')
        """, (unique_reg_id, event_id, student_name, student_email, student_register_number))
        db.commit()

        return jsonify({
            'success': True,
            'message': 'Registration successful! Keep your Registration ID for campus entry.',
            'data': {
                'registration_id': unique_reg_id,
                'event_title': event['title'],
                'event_date': event['event_date'],
                'event_time': event['event_time'],
                'venue': event['venue'],
                'student_name': student_name,
                'student_register_number': student_register_number
            }
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': f'Database error occurred: {str(e)}'}), 500


@app.route('/api/my-registrations', methods=['GET'])
def api_get_student_registrations():
    """
    Retrieve registrations for a given register number.
    Restricted to specific register number to prevent public data exposure.
    """
    reg_no = request.args.get('register_number', '').strip().upper()
    if not reg_no or len(reg_no) < 3:
        return jsonify({'success': False, 'message': 'Please provide a valid student register number.'}), 400

    db = g.db
    cursor = db.cursor()
    cursor.execute("""
        SELECT 
            r.id,
            r.registration_id,
            r.student_name,
            r.student_email,
            r.student_register_number,
            r.registered_at,
            r.status,
            e.id as event_id,
            e.title as event_title,
            e.category as event_category,
            e.event_date,
            e.event_time,
            e.venue
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.student_register_number = ?
        ORDER BY r.registered_at DESC
    """, (reg_no,))

    rows = cursor.fetchall()
    registrations = []
    today_str = datetime.now().strftime("%Y-%m-%d")

    for row in rows:
        reg = dict(row)
        reg['is_past'] = reg['event_date'] < today_str
        reg['can_cancel'] = (reg['status'] == 'Confirmed') and not reg['is_past']
        registrations.append(reg)

    return jsonify({
        'success': True,
        'message': f'Found {len(registrations)} registration(s).',
        'data': registrations
    })


@app.route('/api/registrations/cancel', methods=['POST'])
def api_cancel_registration():
    """
    Cancel an active registration.
    Validates ownership by matching registration_id and student_register_number.
    """
    data = request.get_json() or {}
    registration_id = (data.get('registration_id') or '').strip().upper()
    student_register_number = (data.get('student_register_number') or '').strip().upper()

    if not registration_id or not student_register_number:
        return jsonify({
            'success': False,
            'message': 'Registration ID and student register number are required to cancel.'
        }), 400

    db = g.db
    cursor = db.cursor()

    cursor.execute("""
        SELECT r.*, e.event_date, e.title as event_title
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.registration_id = ? AND r.student_register_number = ?
    """, (registration_id, student_register_number))
    reg = cursor.fetchone()

    if not reg:
        return jsonify({
            'success': False,
            'message': 'No matching registration found. Please check your Registration ID and Register Number.'
        }), 404

    if reg['status'] == 'Cancelled':
        return jsonify({
            'success': False,
            'message': 'This registration has already been cancelled.'
        }), 400

    # Prevent cancellation of past events
    today_str = datetime.now().strftime("%Y-%m-%d")
    if reg['event_date'] < today_str:
        return jsonify({
            'success': False,
            'message': 'Cannot cancel registrations for past events.'
        }), 400

    cursor.execute("""
        UPDATE registrations 
        SET status = 'Cancelled' 
        WHERE id = ?
    """, (reg['id'],))
    db.commit()

    return jsonify({
        'success': True,
        'message': f"Registration for '{reg['event_title']}' ({registration_id}) has been cancelled successfully."
    })


# ---------------------------------------------------------
# Organizer Authentication Endpoints
# ---------------------------------------------------------

@app.route('/api/organizer/login', methods=['POST'])
def api_organizer_login():
    """Authenticate organizer and establish secure session."""
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required.'}), 400

    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT * FROM organizers WHERE username = ?", (username,))
    organizer = cursor.fetchone()

    if not organizer or not check_password_hash(organizer['password_hash'], password):
        return jsonify({'success': False, 'message': 'Invalid username or password.'}), 401

    session.clear()
    session['organizer_id'] = organizer['id']
    session['username'] = organizer['username']
    session['organizer_name'] = organizer['full_name']
    session.permanent = True

    return jsonify({
        'success': True,
        'message': f"Welcome back, {organizer['full_name']}!",
        'data': {
            'username': organizer['username'],
            'full_name': organizer['full_name'],
            'email': organizer['email']
        }
    })


@app.route('/api/organizer/logout', methods=['POST'])
def api_organizer_logout():
    """End organizer session."""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully.'})


@app.route('/organizer/logout')
def organizer_logout_redirect():
    """Convenience redirect route for GET logout."""
    session.clear()
    flash('You have been logged out securely.', 'info')
    return redirect(url_for('organizer_login_page'))


# ---------------------------------------------------------
# Organizer Management Endpoints (Protected)
# ---------------------------------------------------------

@app.route('/api/organizer/stats', methods=['GET'])
@organizer_required
def api_organizer_stats():
    """Compute and return comprehensive analytics for the organizer dashboard."""
    db = g.db
    cursor = db.cursor()
    today_str = datetime.now().strftime("%Y-%m-%d")

    cursor.execute("SELECT COUNT(*) as total FROM events")
    total_events = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) as upcoming FROM events WHERE event_date >= ?", (today_str,))
    upcoming_events = cursor.fetchone()['upcoming']

    cursor.execute("SELECT COUNT(*) as past FROM events WHERE event_date < ?", (today_str,))
    past_events = cursor.fetchone()['past']

    cursor.execute("SELECT COUNT(*) as total FROM registrations WHERE status = 'Confirmed'")
    total_registrations = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) as cancelled FROM registrations WHERE status = 'Cancelled'")
    cancelled_registrations = cursor.fetchone()['cancelled']

    # Most popular events
    cursor.execute("""
        SELECT 
            e.id, 
            e.title, 
            e.category, 
            e.capacity,
            e.event_date,
            COUNT(r.id) as confirmed_count
        FROM events e
        LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'Confirmed'
        GROUP BY e.id
        ORDER BY confirmed_count DESC, e.event_date ASC
        LIMIT 5
    """)
    popular_events = [dict(row) for row in cursor.fetchall()]

    # Registrations by category
    cursor.execute("""
        SELECT e.category, COUNT(r.id) as count
        FROM events e
        LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'Confirmed'
        GROUP BY e.category
    """)
    category_breakdown = [dict(row) for row in cursor.fetchall()]

    return jsonify({
        'success': True,
        'message': 'Dashboard statistics calculated.',
        'data': {
            'total_events': total_events,
            'upcoming_events': upcoming_events,
            'past_events': past_events,
            'total_registrations': total_registrations,
            'cancelled_registrations': cancelled_registrations,
            'popular_events': popular_events,
            'category_breakdown': category_breakdown
        }
    })


@app.route('/api/organizer/events', methods=['POST'])
@organizer_required
def api_create_event():
    """Create a new event."""
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    category = (data.get('category') or '').strip()
    description = (data.get('description') or '').strip()
    event_date = (data.get('event_date') or '').strip()
    event_time = (data.get('event_time') or '').strip()
    venue = (data.get('venue') or '').strip()
    organizer_name = (data.get('organizer_name') or session.get('organizer_name', 'Event Coordinator')).strip()

    try:
        capacity = int(data.get('capacity', 100))
        if capacity <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Capacity must be a positive number greater than 0.'}), 400

    if not title or len(title) < 3:
        return jsonify({'success': False, 'message': 'Event title must be at least 3 characters long.'}), 400
    if not category:
        return jsonify({'success': False, 'message': 'Category is required.'}), 400
    if not description or len(description) < 10:
        return jsonify({'success': False, 'message': 'Description must be at least 10 characters long.'}), 400
    if not event_date:
        return jsonify({'success': False, 'message': 'Event date is required (YYYY-MM-DD).'}), 400
    if not event_time:
        return jsonify({'success': False, 'message': 'Event time is required (HH:MM).'}), 400
    if not venue or len(venue) < 2:
        return jsonify({'success': False, 'message': 'Venue is required.'}), 400

    # Validate date format
    try:
        datetime.strptime(event_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({'success': False, 'message': 'Invalid date format. Expected YYYY-MM-DD.'}), 400

    db = g.db
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO events (title, category, description, event_date, event_time, venue, capacity, organizer_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, category, description, event_date, event_time, venue, capacity, organizer_name))
    db.commit()
    new_id = cursor.lastrowid

    return jsonify({
        'success': True,
        'message': f"Event '{title}' created successfully!",
        'data': {'event_id': new_id}
    }), 201


@app.route('/api/organizer/events/<int:event_id>', methods=['PUT'])
@organizer_required
def api_update_event(event_id):
    """Update details of an existing event."""
    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        return jsonify({'success': False, 'message': 'Event not found.'}), 404

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    category = (data.get('category') or '').strip()
    description = (data.get('description') or '').strip()
    event_date = (data.get('event_date') or '').strip()
    event_time = (data.get('event_time') or '').strip()
    venue = (data.get('venue') or '').strip()
    organizer_name = (data.get('organizer_name') or event['organizer_name']).strip()

    try:
        capacity = int(data.get('capacity', event['capacity']))
        if capacity <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Capacity must be a positive integer.'}), 400

    if not title or len(title) < 3:
        return jsonify({'success': False, 'message': 'Event title is required.'}), 400
    if not category:
        return jsonify({'success': False, 'message': 'Category is required.'}), 400
    if not description or len(description) < 10:
        return jsonify({'success': False, 'message': 'Description must be at least 10 characters long.'}), 400
    if not event_date or not event_time or not venue:
        return jsonify({'success': False, 'message': 'Date, time, and venue are all required.'}), 400

    # Ensure capacity is not reduced below existing confirmed registrations
    cursor.execute("SELECT COUNT(*) as count FROM registrations WHERE event_id = ? AND status = 'Confirmed'", (event_id,))
    reg_count = cursor.fetchone()['count']
    if capacity < reg_count:
        return jsonify({
            'success': False,
            'message': f'Cannot reduce capacity to {capacity}. There are already {reg_count} confirmed participants.'
        }), 400

    cursor.execute("""
        UPDATE events 
        SET title = ?, category = ?, description = ?, event_date = ?, event_time = ?, venue = ?, capacity = ?, organizer_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (title, category, description, event_date, event_time, venue, capacity, organizer_name, event_id))
    db.commit()

    return jsonify({
        'success': True,
        'message': f"Event '{title}' updated successfully!"
    })


@app.route('/api/organizer/events/<int:event_id>', methods=['DELETE'])
@organizer_required
def api_delete_event(event_id):
    """Delete an event and its related registrations."""
    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT title FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        return jsonify({'success': False, 'message': 'Event not found.'}), 404

    cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
    db.commit()

    return jsonify({
        'success': True,
        'message': f"Event '{event['title']}' and its registrations have been deleted."
    })


@app.route('/api/organizer/events/<int:event_id>/participants', methods=['GET'])
@organizer_required
def api_get_event_participants(event_id):
    """Retrieve participant list for a specific event."""
    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        return jsonify({'success': False, 'message': 'Event not found.'}), 404

    cursor.execute("""
        SELECT id, registration_id, student_name, student_email, student_register_number, registered_at, status
        FROM registrations
        WHERE event_id = ?
        ORDER BY registered_at DESC
    """, (event_id,))
    participants = [dict(row) for row in cursor.fetchall()]

    return jsonify({
        'success': True,
        'message': f'Found {len(participants)} participant(s).',
        'data': {
            'event': dict(event),
            'participants': participants
        }
    })


@app.route('/organizer/events/<int:event_id>/participants/export')
@organizer_required
def export_participants_csv(event_id):
    """Export event participants as a downloadable CSV file."""
    db = g.db
    cursor = db.cursor()
    cursor.execute("SELECT title, event_date FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        flash('Event not found.', 'danger')
        return redirect(url_for('manage_events_page'))

    cursor.execute("""
        SELECT registration_id, student_name, student_email, student_register_number, registered_at, status
        FROM registrations
        WHERE event_id = ?
        ORDER BY registered_at ASC
    """, (event_id,))
    rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Registration ID', 'Student Name', 'College Email', 'Register Number', 'Registered At', 'Status'])

    for row in rows:
        writer.writerow([
            row['registration_id'],
            row['student_name'],
            row['student_email'],
            row['student_register_number'],
            row['registered_at'],
            row['status']
        ])

    csv_data = output.getvalue()
    response = make_response(csv_data)
    safe_title = "".join(c for c in event['title'] if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"Participants_{safe_title}_{event['event_date']}.csv"
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    response.headers["Content-type"] = "text/csv"
    return response


# ---------------------------------------------------------
# Error Handlers
# ---------------------------------------------------------
@app.errorhandler(404)
def not_found_error(error):
    if request.is_json or request.path.startswith('/api/'):
        return jsonify({'success': False, 'message': 'API endpoint or resource not found.'}), 404
    return render_template('base.html', not_found=True), 404


@app.errorhandler(500)
def internal_error(error):
    if request.is_json or request.path.startswith('/api/'):
        return jsonify({'success': False, 'message': 'Internal server error occurred.'}), 500
    return render_template('base.html', server_error=True), 500


if __name__ == '__main__':
    # Running in debug mode for development demonstration
    app.run(host='127.0.0.1', port=5000, debug=True)
