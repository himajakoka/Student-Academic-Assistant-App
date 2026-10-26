/**
 * events.js - Event Discovery, Dynamic Filtering, and Registration Workflow
 */

let allEventsCache = [];
let currentCategory = 'all';
let currentSearch = '';
let currentStatus = 'upcoming';

// Debounce helper for live keyword search
function debounce(func, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Fetch events from Flask REST API.
 */
async function loadEvents() {
  const container = document.getElementById('events-container');
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
      <div class="loading-spinner"></div>
      <p style="color: var(--text-muted); margin-top: 1rem;">Loading upcoming events...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams();
    if (currentCategory && currentCategory !== 'all') {
      params.append('category', currentCategory);
    }
    if (currentSearch) {
      params.append('search', currentSearch);
    }
    if (currentStatus) {
      params.append('status', currentStatus);
    }

    const response = await fetch(`/api/events?${params.toString()}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to retrieve events.');
    }

    allEventsCache = result.data;
    renderEvents(allEventsCache);
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon" style="color: var(--danger);">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h3 class="empty-state-title">Error Loading Events</h3>
        <p class="empty-state-text">${App.escapeHtml(error.message)}</p>
        <button class="btn btn-primary btn-sm" onclick="loadEvents()">Try Again</button>
      </div>
    `;
    App.showToast('danger', 'Error', error.message);
  }
}

/**
 * Render event cards into the grid container.
 */
function renderEvents(events) {
  const container = document.getElementById('events-container');
  const countBadge = document.getElementById('events-count-badge');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${events.length} Event${events.length === 1 ? '' : 's'}`;
  }

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <h3 class="empty-state-title">No Events Found</h3>
        <p class="empty-state-text">We couldn't find any events matching your search or category filter. Try clearing filters.</p>
        <button class="btn btn-secondary btn-sm" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  const cardsHtml = events.map(ev => {
    const categoryClass = `category-${(ev.category || 'other').toLowerCase()}`;
    const bannerClass = `event-banner-${(ev.category || 'other').toLowerCase()}`;
    
    // Parse date for badge
    const dateParts = ev.event_date.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const month = dateObj.toLocaleString('en-US', { month: 'short' });
    const day = dateParts[2];

    // Capacity percentage
    const percent = Math.min(100, Math.round((ev.registered_count / ev.capacity) * 100));
    let progressClass = '';
    if (percent >= 100) progressClass = 'full';
    else if (percent >= 85) progressClass = 'near-full';

    // Status pill
    let statusPill = '';
    let registerButton = '';

    if (ev.is_past) {
      statusPill = `<span class="status-pill status-past">Past Event</span>`;
      registerButton = `<button class="btn btn-secondary btn-sm btn-block" disabled>Registration Closed</button>`;
    } else if (ev.is_full) {
      statusPill = `<span class="status-pill status-full">Full Capacity</span>`;
      registerButton = `<button class="btn btn-secondary btn-sm btn-block" disabled>Event Full</button>`;
    } else {
      if (percent >= 85) {
        statusPill = `<span class="status-pill status-selling-fast">Only ${ev.remaining_spots} Spots Left</span>`;
      } else {
        statusPill = `<span class="status-pill status-open">Open</span>`;
      }
      registerButton = `
        <button class="btn btn-primary btn-sm btn-block" onclick="openRegistrationModal(${ev.id}, '${App.escapeHtml(ev.title)}')">
          Register Now
        </button>
      `;
    }

    return `
      <div class="event-card">
        <div class="event-card-banner ${bannerClass}">
          <span class="category-pill ${categoryClass}">${App.escapeHtml(ev.category)}</span>
          <div class="date-badge">
            <div class="date-badge-month">${month}</div>
            <div class="date-badge-day">${day}</div>
          </div>
        </div>

        <div class="event-card-body">
          <h3 class="event-card-title">
            <a href="/events/${ev.id}">${App.escapeHtml(ev.title)}</a>
          </h3>
          <p class="event-card-desc">${App.escapeHtml(ev.description)}</p>

          <div class="event-card-meta">
            <div class="meta-row">
              <svg class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${App.formatTime(ev.event_time)}</span>
            </div>
            <div class="meta-row">
              <svg class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${App.escapeHtml(ev.venue)}</span>
            </div>
          </div>

          <div class="capacity-wrapper">
            <div class="capacity-info">
              <span style="color: var(--text-muted); font-size: 0.78rem;">Capacity (${ev.registered_count}/${ev.capacity})</span>
              ${statusPill}
            </div>
            <div class="capacity-bar">
              <div class="capacity-progress ${progressClass}" style="width: ${percent}%;"></div>
            </div>
          </div>

          <div class="event-card-footer">
            <a href="/events/${ev.id}" class="btn btn-secondary btn-sm" style="flex: 1;">Details</a>
            <div style="flex: 1.3;">
              ${registerButton}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
}

/**
 * Reset all search and category filters.
 */
function resetFilters() {
  currentCategory = 'all';
  currentSearch = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === 'all');
  });

  loadEvents();
}

/**
 * Open registration modal with prefilled event metadata.
 */
function openRegistrationModal(eventId, eventTitle) {
  const modal = document.getElementById('registration-modal');
  if (!modal) return;

  // Reset form views
  document.getElementById('registration-form-view').style.display = 'block';
  document.getElementById('registration-success-view').style.display = 'none';
  document.getElementById('register-submit-btn').style.display = 'inline-flex';
  document.getElementById('register-submit-btn').disabled = false;
  document.getElementById('register-submit-btn').innerHTML = 'Confirm Registration';

  // Set fields
  document.getElementById('reg-event-id').value = eventId;
  document.getElementById('reg-event-title').textContent = eventTitle;
  document.getElementById('reg-student-name').value = '';
  document.getElementById('reg-student-email').value = '';
  document.getElementById('reg-student-regno').value = '';

  App.openModal('registration-modal');
}

/**
 * Handle student registration submission.
 */
async function handleRegistrationSubmit(event) {
  event.preventDefault();

  const eventId = document.getElementById('reg-event-id').value;
  const name = document.getElementById('reg-student-name').value.trim();
  const email = document.getElementById('reg-student-email').value.trim();
  const regno = document.getElementById('reg-student-regno').value.trim().toUpperCase();

  // Basic client-side validations
  if (!name || name.length < 2) {
    App.showToast('warning', 'Validation', 'Please enter your full name (at least 2 letters).');
    return;
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    App.showToast('warning', 'Validation', 'Please enter a valid email address.');
    return;
  }
  if (!regno || regno.length < 4) {
    App.showToast('warning', 'Validation', 'Please enter a valid Register Number (e.g., 2024BCA014).');
    return;
  }

  const submitBtn = document.getElementById('register-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> Registering...`;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: parseInt(eventId, 10),
        student_name: name,
        student_email: email,
        student_register_number: regno
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Registration failed.');
    }

    // Success: Show ticket view
    App.showToast('success', 'Registered Successfully!', `Pass ID: ${result.data.registration_id}`);

    document.getElementById('registration-form-view').style.display = 'none';
    submitBtn.style.display = 'none';

    const successView = document.getElementById('registration-success-view');
    successView.style.display = 'block';

    document.getElementById('ticket-reg-id').textContent = result.data.registration_id;
    document.getElementById('ticket-student-name').textContent = result.data.student_name;
    document.getElementById('ticket-reg-no').textContent = result.data.student_register_number;
    document.getElementById('ticket-event-title').textContent = result.data.event_title;
    document.getElementById('ticket-event-date').textContent = `${App.formatDate(result.data.event_date)} at ${App.formatTime(result.data.event_time)}`;
    document.getElementById('ticket-venue').textContent = result.data.venue;

    // Refresh events list to reflect updated capacity
    loadEvents();
  } catch (error) {
    App.showToast('danger', 'Registration Error', error.message);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Confirm Registration';
  }
}

// Initialize event page controls on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Category Chips
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category || 'all';
      loadEvents();
    });
  });

  // Live Search Input with Debounce
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentSearch = e.target.value.trim();
      loadEvents();
    }, 300));
  }

  // Registration Form
  const regForm = document.getElementById('student-registration-form');
  if (regForm) {
    regForm.addEventListener('submit', handleRegistrationSubmit);
  }

  // Initial event load if on events page
  if (document.getElementById('events-container')) {
    // If URL has params (e.g. from homepage category click)
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('category');
    const searchParam = urlParams.get('search');

    if (catParam) {
      currentCategory = catParam;
      filterChips.forEach(chip => {
        chip.classList.toggle('active', chip.dataset.category.toLowerCase() === catParam.toLowerCase());
      });
    }

    if (searchParam && searchInput) {
      currentSearch = searchParam;
      searchInput.value = searchParam;
    }

    loadEvents();
  }
});
