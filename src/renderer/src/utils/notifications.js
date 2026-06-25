import { toast } from './dom-utils.js';

export const NotificationSystem = {
  success(title, message) {
    toast.show(`${title}: ${message}`, 'success');
  },
  error(title, message) {
    toast.show(`${title}: ${message}`, 'error');
  },
  info(title, message) {
    toast.show(`${title}: ${message}`, 'info');
  },
  warning(title, message) {
    toast.show(`${title}: ${message}`, 'warning');
  }
};
