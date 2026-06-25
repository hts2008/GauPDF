/* src/renderer/js/ui/notifications.js */

export class NotificationSystem {
  static container = null;

  static init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  static show(title, message, type = 'info', duration = 4000) {
    if (!this.container) {
      this.init();
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    
    // Choose icon based on notification type
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'danger') icon = '❌';
    else if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
    `;

    this.container.appendChild(toast);

    // Trigger reflow for CSS animation
    toast.offsetHeight;
    toast.classList.add('show');

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    }, duration);
  }

  static success(title, message, duration) {
    this.show(title, message, 'success', duration);
  }

  static info(title, message, duration) {
    this.show(title, message, 'info', duration);
  }

  static warning(title, message, duration) {
    this.show(title, message, 'warning', duration);
  }

  static error(title, message, duration) {
    this.show(title, message, 'danger', duration);
  }
}

// Auto-initialize when loaded
document.addEventListener('DOMContentLoaded', () => {
  NotificationSystem.init();
});
