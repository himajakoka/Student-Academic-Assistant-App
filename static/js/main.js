/**
 * main.js - Core UI Utilities for College Event Management Portal
 * Toast Notifications, Modals, Confirmation Dialogs, and Mobile Navigation.
 */

// Global App State & Utilities
const App = {
  /**
   * Display a floating toast notification.
   * @param {string} type - 'success', 'danger', 'warning', 'info'
   * @param {string} title - Heading of the toast
   * @param {string} message - Explanatory message
   * @param {number} duration - Auto close duration in ms (default 4000)
   */
  showToast(type = 'info', title = '', message = '', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      danger: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <div class="toast-title">${App.escapeHtml(title)}</div>
        <div class="toast-message">${App.escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => toast.classList.add('show'));

    const dismissToast = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismissToast);
    if (duration > 0) {
      setTimeout(dismissToast, duration);
    }
  },

  /**
   * Open modal by DOM element ID.
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * Close modal by DOM element ID.
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      // If no other modal is open, restore scroll
      if (!document.querySelector('.modal-backdrop.open')) {
        document.body.style.overflow = '';
      }
    }
  },

  /**
   * Show a unified custom confirmation modal dialog.
   * @param {Object} options
   */
  showConfirmDialog({ title, message, confirmText = 'Confirm', confirmStyle = 'danger', onConfirm }) {
    let confirmModal = document.getElementById('global-confirm-modal');
    if (!confirmModal) {
      confirmModal = document.createElement('div');
      confirmModal.id = 'global-confirm-modal';
      confirmModal.className = 'modal-backdrop';
      confirmModal.innerHTML = `
        <div class="modal-window" style="max-width: 440px;">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-title">Confirm Action</h3>
            <button type="button" class="modal-close-btn" onclick="App.closeModal('global-confirm-modal')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body">
            <p id="confirm-message" style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5;"></p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="App.closeModal('global-confirm-modal')">Cancel</button>
            <button type="button" id="confirm-submit-btn" class="btn">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmModal);
    }

    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const submitBtn = document.getElementById('confirm-submit-btn');
    submitBtn.textContent = confirmText;
    submitBtn.className = `btn btn-${confirmStyle}`;

    // Remove existing event listener clones
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

    newSubmitBtn.addEventListener('click', async () => {
      App.closeModal('global-confirm-modal');
      if (typeof onConfirm === 'function') {
        await onConfirm();
      }
    });

    App.openModal('global-confirm-modal');
  },

  /**
   * Safely escape HTML to prevent XSS.
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Format date into user-friendly standard string (e.g., 'Wed, Oct 28, 2026').
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  },

  /**
   * Format time into 12-hour AM/PM format (e.g. '09:30 AM').
   */
  formatTime(timeStr) {
    if (!timeStr) return '';
    try {
      const [h, m] = timeStr.split(':');
      let hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour}:${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  }
};

// Initialize listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav drawer toggle
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        App.closeModal(modal.id);
      }
    });
  });

  // Close modal when pressing ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-backdrop.open');
      if (openModal) {
        App.closeModal(openModal.id);
      }
    }
  });
});
