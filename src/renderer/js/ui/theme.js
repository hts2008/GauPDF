/* src/renderer/js/ui/theme.js */

import { THEMES } from '../../../shared/constants.js';

export class ThemeManager {
  static currentTheme = THEMES.DARK;

  static init() {
    // Load setting from localStorage or fallback to dark
    const savedTheme = localStorage.getItem('gaupdf-theme');
    
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Default to dark theme, or check system preference
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      this.setTheme(prefersLight ? THEMES.LIGHT : THEMES.DARK);
    }
  }

  static setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('gaupdf-theme', theme);

    if (theme === THEMES.LIGHT) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }

    // Sync theme select dropdown if it exists on page
    const themeSelect = document.getElementById('settings-theme');
    if (themeSelect) {
      themeSelect.value = theme;
    }
  }

  static toggleTheme() {
    const nextTheme = this.currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    this.setTheme(nextTheme);
    return nextTheme;
  }
}
