/**
 * registrations.js - Student Registration Lookup and Cancellation
 */

let currentLookupRegNo = '';

/**
 * Perform lookup for student registrations.
 */
async function lookupStudentRegistrations(e) {
  if (e) e.preventDefault();

  const input = document.getElementById('student-regno-input');
  if (!input) return;

  const regNo = input.value.trim().toUpperCase();
  if (!regNo || regNo.length < 3) {
    App.showToast('warning', 'Validation', 'Please enter your valid student register number.');
    return;
  }

  currentLookupRegNo = regNo;
  const container = document.getElementById('registrations-list-container');
  const resultsCard = document.getElementById('registrations-results-card');

  if (resultsCard) resultsCard.style.display = 'block';

  container.innerHTML = `
    <div style="text-align: center; padding: 2.5rem 0;">
      <div class="loading-spinner"></div>
      <p style="color: var(--text-muted); margin-top: 1rem;">Searching registrations for <strong>${App.escapeHtml(regNo)}</strong>...</p>
    </div>
  `;

  try {
    const response = await fetch(`/api/my-registrations?register_number=${encodeURIComponent(regNo)}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to search registrations.');
    }

    renderRegistrations(result.data);
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="color: var(--danger);">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h3 class="empty-state-title">Lookup Failed</h3>
        <p class="empty-state-text">${App.escapeHtml(error.message)}</p>
      </div>
    `;
    App.showToast('danger', 'Error', error.message);
  }
}

/**
 * Render registrations list.
 */
function renderRegistrations(registrations) {
  const container = document.getElementById('registrations-list-container');
  const countBadge = document.getElementById('reg-count-badge');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${registrations.length} Found`;
  }

  if (registrations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <h3 class="empty-state-title">No Registrations Found</h3>
        <p class="empty-state-text">No event registrations found for Register Number "<strong>${App.escapeHtml(currentLookupRegNo)}</strong>". Have you registered for an upcoming event?</p>
        <a href="/events" class="btn btn-primary btn-sm">Explore Events & Register</a>
      </div>
    `;
    return;
  }

  const html = registrations.map(reg => {
    const isCancelled = reg.status === 'Cancelled';
    const statusPill = isCancelled
      ? `<span class="status-pill status-past">Cancelled</span>`
      : reg.is_past
        ? `<span class="status-pill status-past">Event Passed</span>`
        : `<span class="status-pill status-open">Confirmed Pass</span>`;

    const categoryClass = `category-${(reg.event_category || 'other').toLowerCase()}`;

    let actionButton = '';
    if (reg.can_cancel) {
      actionButton = `
        <button class="btn btn-danger-outline btn-sm" onclick="confirmCancelRegistration('${reg.registration_id}', '${App.escapeHtml(reg.event_title)}')">
          Cancel Registration
        </button>
      `;
    }

    return `
      <div class="ticket-card" style="${isCancelled ? 'opacity: 0.65; border-color: var(--border);' : ''}">
        <div class="ticket-header">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="category-pill ${categoryClass}">${App.escapeHtml(reg.event_category)}</span>
            <span class="ticket-id-tag">${App.escapeHtml(reg.registration_id)}</span>
          </div>
          <div>
            ${statusPill}
          </div>
        </div>

        <div style="margin-bottom: 1rem;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--navy-900); margin-bottom: 0.35rem;">
            ${App.escapeHtml(reg.event_title)}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Registered Student: <strong>${App.escapeHtml(reg.student_name)}</strong> (${App.escapeHtml(reg.student_register_number)})</p>
        </div>

        <div class="ticket-grid">
          <div>
            <div class="ticket-field-label">Date & Time</div>
            <div class="ticket-field-value">${App.formatDate(reg.event_date)} at ${App.formatTime(reg.event_time)}</div>
          </div>
          <div>
            <div class="ticket-field-label">Venue</div>
            <div class="ticket-field-value">${App.escapeHtml(reg.venue)}</div>
          </div>
          <div>
            <div class="ticket-field-label">Registered On</div>
            <div class="ticket-field-value">${reg.registered_at ? reg.registered_at.split(' ')[0] : 'N/A'}</div>
          </div>
          <div>
            <div class="ticket-field-label">College Email</div>
            <div class="ticket-field-value">${App.escapeHtml(reg.student_email)}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border);">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">Print Pass</button>
          ${actionButton}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

/**
 * Prompt user before cancelling their registration.
 */
function confirmCancelRegistration(registrationId, eventTitle) {
  App.showConfirmDialog({
    title: 'Cancel Registration?',
    message: `Are you sure you want to cancel your registration (${registrationId}) for "${eventTitle}"? Your spot will be released.`,
    confirmText: 'Yes, Cancel Registration',
    confirmStyle: 'danger',
    onConfirm: async () => {
      try {
        const response = await fetch('/api/registrations/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_id: registrationId,
            student_register_number: currentLookupRegNo
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to cancel registration.');
        }

        App.showToast('success', 'Cancelled', result.message);
        // Refresh lookup list
        lookupStudentRegistrations();
      } catch (error) {
        App.showToast('danger', 'Cancellation Failed', error.message);
      }
    }
  });
}

// Bind lookup form on page load
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registration-lookup-form');
  if (form) {
    form.addEventListener('submit', lookupStudentRegistrations);
  }

  // If initial register number is in input (from server or URL param), trigger lookup
  const regInput = document.getElementById('student-regno-input');
  if (regInput && regInput.value.trim()) {
    lookupStudentRegistrations();
  }
});
