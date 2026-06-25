// src/shared/constants.js

export const IPC_CHANNELS = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_CHANGED: 'file:changed',
  PRINT_EXECUTE: 'print:execute',
  PRINT_GET_PRINTERS: 'print:get-printers',
  PRINT_TO_PDF: 'print:to-pdf',
  PDF_MERGE: 'pdf:merge',
  PDF_SPLIT: 'pdf:split',
  PDF_COMPRESS: 'pdf:compress',
  PDF_CONVERT_TO_PDF: 'pdf:convert-to-pdf',
  PDF_CONVERT_FROM_PDF: 'pdf:convert-from-pdf',
  APP_RECENT_FILES: 'app:recent-files',
  APP_SETTINGS: 'app:settings',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_CLOSE: 'app:close',
  OCR_EXECUTE: 'ocr:execute'
}

export const MODES = {
  VIEW: 'view',
  EDIT: 'edit',
  COMMENT: 'comment',
  ORGANIZE: 'organize',
  FORMS: 'forms'
}

export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light'
}
