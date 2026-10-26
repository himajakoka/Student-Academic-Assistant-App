/**
 * organizer.js - Organizer Authentication, Analytics Dashboard, and Event CRUD
 */

// -------------------------------------------------------------
// 1. Organizer Authentication
// -------------------------------------------------------------
async function handleOrganizerLogin(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('login-submit-btn');

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    App.showToast('warning', 'Login', 'Please enter your username and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> Authenticating...`;

  try {
    const response = await fetch('/api/organizer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Login failed. Invalid credentials.');
    }

    App.showToast('success', 'Authenticated', result.message);

    // Redirect to dashboard or next url
    const urlParams = new URLSearchParams(window.location.search);
    const nextUrl = urlParams.get('next') || '/organizer/dashboard';
    setTimeout(() => {
      window.location.href = nextUrl;
    }, 600);
  } catch (error) {
    App.showToast('danger', 'Authentication Failed', error.message);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign In to Portal';
  }
}

/**
 * Quick-fill demo credentials for presentation ease.
 */
function quickFillDemoCredentials() {
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  if (usernameInput && passwordInput) {
    usernameInput.value = 'admin';
    passwordInput.value = 'admin123';
    App.showToast('info', 'Demo Credentials', 'Filled admin / admin123');
  }
}

// -------------------------------------------------------------
// 2. Organizer Dashboard Analytics
// -------------------------------------------------------------
async function loadOrganizerDashboardStats() {
  const statsContainer = document.getElementById('dashboard-metrics-row');
  if (!statsContainer) return;

  try {
    const response = await fetch('/api/organizer/stats');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load dashboard metrics.');
    }

    const { total_events, upcoming_events, total_registrations, cancelled_registrations, popular_events, category_breakdown } = result.data;

    // Update metric counters
    const elTotalEvents = document.getElementById('metric-total-events');
    const elUpcomingEvents = document.getElementById('metric-upcoming-events');
    const elTotalRegistrations = document.getElementById('metric-total-registrations');
    const elCancelledRegistrations = document.getElementById('metric-cancelled-registrations');

    if (elTotalEvents) elTotalEvents.textContent = total_events;
    if (elUpcomingEvents) elUpcomingEvents.textContent = upcoming_events;
    if (elTotalRegistrations) elTotalRegistrations.textContent = total_registrations;
    if (elCancelledRegistrations) elCancelledRegistrations.textContent = cancelled_registrations;

    // Render Popular Events Table
    const popTableBody = document.getElementById('popular-events-tbody');
    if (popTableBody) {
      if (popular_events.length === 0) {
        popTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No events available.</td></tr>`;
      } else {
        popTableBody.innerHTML = popular_events.map(ev => {
          const percent = Math.min(100, Math.round((ev.confirmed_count / ev.capacity) * 100));
          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--navy-900);">${App.escapeHtml(ev.title)}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${App.formatDate(ev.event_date)}</div>
              </td>
              <td>
                <span class="category-pill category-${(ev.category || 'other').toLowerCase()}">${App.escapeHtml(ev.category)}</span>
              </td>
              <td style="min-width: 140px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">
                  <span>${ev.confirmed_count} / ${ev.capacity}</span>
                  <span>${percent}%</span>
                </div>
                <div class="capacity-bar">
                  <div class="capacity-progress" style="width: ${percent}%;"></div>
                </div>
              </td>
              <td>
                <a href="/organizer/events/${ev.id}/participants" class="btn btn-secondary btn-sm">Participants</a>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Categories Breakdown List
    const catContainer = document.getElementById('category-breakdown-list');
    if (catContainer) {
      if (category_breakdown.length === 0) {
        catContainer.innerHTML = `<p style="color: var(--text-muted);">No categories available.</p>`;
      } else {
        catContainer.innerHTML = category_breakdown.map(item => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="category-pill category-${(item.category || 'other').toLowerCase()}">${App.escapeHtml(item.category)}</span>
            </div>
            <span style="font-weight: 700; font-size: 0.95rem; color: var(--navy-900);">${item.count} Registered</span>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    App.showToast('danger', 'Analytics Error', error.message);
  }
}

// -------------------------------------------------------------
// 3. Organizer Event Management (Create, Edit, Delete)
// -------------------------------------------------------------
let organizerEventsList = [];

async function loadOrganizerEvents() {
  const tbody = document.getElementById('organizer-events-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 3rem 0;">
        <div class="loading-spinner"></div>
        <p style="color: var(--text-muted); margin-top: 0.75rem;">Loading events catalogue...</p>
      </td>
    </tr>
  `;

  try {
    const response = await fetch('/api/events?status=all');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to retrieve events.');
    }

    organizerEventsList = result.data;
    renderOrganizerEventsTable(organizerEventsList);
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">
          ${App.escapeHtml(error.message)}
        </td>
      </tr>
    `;
    App.showToast('danger', 'Error', error.message);
  }
}

function renderOrganizerEventsTable(events) {
  const tbody = document.getElementById('organizer-events-tbody');
  const countBadge = document.getElementById('events-table-count');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${events.length} Event${events.length === 1 ? '' : 's'}`;
  }

  if (events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem 0; color: var(--text-muted);">
          No events found. Click "Create New Event" to get started.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.map(ev => {
    const isPast = ev.is_past;
    const percent = Math.min(100, Math.round((ev.registered_count / ev.capacity) * 100));

    return `
      <tr style="${isPast ? 'opacity: 0.75;' : ''}">
        <td>
          <div style="font-weight: 700; color: var(--navy-900); font-size: 0.95rem;">${App.escapeHtml(ev.title)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${App.escapeHtml(ev.organizer_name || 'Coordinator')}</div>
        </td>
        <td>
          <span class="category-pill category-${(ev.category || 'other').toLowerCase()}">${App.escapeHtml(ev.category)}</span>
        </td>
        <td>
          <div style="font-weight: 600;">${App.formatDate(ev.event_date)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${App.formatTime(ev.event_time)}</div>
        </td>
        <td style="max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${App.escapeHtml(ev.venue)}
        </td>
        <td>
          <div style="font-weight: 600;">${ev.registered_count} / ${ev.capacity}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${ev.remaining_spots} remaining</div>
        </td>
        <td>
          ${isPast 
            ? `<span class="status-pill status-past">Past</span>` 
            : (ev.is_full ? `<span class="status-pill status-full">Full</span>` : `<span class="status-pill status-open">Active</span>`)}
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <a href="/organizer/events/${ev.id}/participants" class="btn btn-secondary btn-sm" title="View Registered Participants">
              Participants
            </a>
            <button class="btn btn-secondary btn-sm" onclick="openEditEventModal(${ev.id})" title="Edit Event Details">
              Edit
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteEvent(${ev.id}, '${App.escapeHtml(ev.title)}')" title="Delete Event">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openCreateEventModal() {
  document.getElementById('event-modal-title').textContent = 'Create New College Event';
  document.getElementById('event-form-id').value = '';
  document.getElementById('event-title').value = '';
  document.getElementById('event-category').value = 'Technical';
  document.getElementById('event-desc').value = '';
  document.getElementById('event-date').value = '';
  document.getElementById('event-time').value = '';
  document.getElementById('event-venue').value = '';
  document.getElementById('event-capacity').value = 100;
  document.getElementById('event-organizer-name').value = 'Department Event Coordinator';

  App.openModal('event-form-modal');
}

function openEditEventModal(eventId) {
  const ev = organizerEventsList.find(e => e.id === eventId);
  if (!ev) return;

  document.getElementById('event-modal-title').textContent = 'Edit Event Details';
  document.getElementById('event-form-id').value = ev.id;
  document.getElementById('event-title').value = ev.title;
  document.getElementById('event-category').value = ev.category;
  document.getElementById('event-desc').value = ev.description;
  document.getElementById('event-date').value = ev.event_date;
  document.getElementById('event-time').value = ev.event_time;
  document.getElementById('event-venue').value = ev.venue;
  document.getElementById('event-capacity').value = ev.capacity;
  document.getElementById('event-organizer-name').value = ev.organizer_name || '';

  App.openModal('event-form-modal');
}

async function handleEventFormSubmit(e) {
  e.preventDefault();

  const eventId = document.getElementById('event-form-id').value;
  const isEdit = Boolean(eventId);

  const payload = {
    title: document.getElementById('event-title').value.trim(),
    category: document.getElementById('event-category').value,
    description: document.getElementById('event-desc').value.trim(),
    event_date: document.getElementById('event-date').value,
    event_time: document.getElementById('event-time').value,
    venue: document.getElementById('event-venue').value.trim(),
    capacity: parseInt(document.getElementById('event-capacity').value, 10),
    organizer_name: document.getElementById('event-organizer-name').value.trim()
  };

  const submitBtn = document.getElementById('event-form-submit-btn');
  submitBtn.disabled = true;

  try {
    const url = isEdit ? `/api/organizer/events/${eventId}` : '/api/organizer/events';
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Operation failed.');
    }

    App.showToast('success', isEdit ? 'Event Updated' : 'Event Created', result.message);
    App.closeModal('event-form-modal');
    loadOrganizerEvents();
  } catch (error) {
    App.showToast('danger', 'Error', error.message);
  } finally {
    submitBtn.disabled = false;
  }
}

function confirmDeleteEvent(eventId, eventTitle) {
  App.showConfirmDialog({
    title: 'Delete Event?',
    message: `Are you sure you want to permanently delete "${eventTitle}"? All student registrations for this event will also be removed.`,
    confirmText: 'Delete Permanently',
    confirmStyle: 'danger',
    onConfirm: async () => {
      try {
        const response = await fetch(`/api/organizer/events/${eventId}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to delete event.');
        }

        App.showToast('success', 'Deleted', result.message);
        loadOrganizerEvents();
      } catch (error) {
        App.showToast('danger', 'Delete Failed', error.message);
      }
    }
  });
}

// -------------------------------------------------------------
// 4. Participant Live Filter
// -------------------------------------------------------------
function setupParticipantFilter() {
  const input = document.getElementById('participant-search-input');
  if (!input) return;

  input.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#participants-tbody tr');

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });
}

// -------------------------------------------------------------
// Page Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Login page form
  const loginForm = document.getElementById('organizer-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleOrganizerLogin);
  }

  // Dashboard page
  if (document.getElementById('dashboard-metrics-row')) {
    loadOrganizerDashboardStats();
  }

  // Manage events page
  if (document.getElementById('organizer-events-tbody')) {
    loadOrganizerEvents();

    const eventForm = document.getElementById('event-form');
    if (eventForm) {
      eventForm.addEventListener('submit', handleEventFormSubmit);
    }

    // Filter events table live
    const searchEventsInput = document.getElementById('organizer-search-events');
    if (searchEventsInput) {
      searchEventsInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = organizerEventsList.filter(ev => 
          ev.title.toLowerCase().includes(term) ||
          ev.category.toLowerCase().includes(term) ||
          ev.venue.toLowerCase().includes(term)
        );
        renderOrganizerEventsTable(filtered);
      });
    }
  }

  // Participants page
  if (document.getElementById('participants-tbody')) {
    setupParticipantFilter();
  }
});
