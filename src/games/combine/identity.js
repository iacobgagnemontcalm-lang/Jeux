// Player identity in Combine is the *username*, not the browser's anonymous
// uid. That is the safeguard the game is built around: close the tab, come
// back (even on another device or after clearing storage), type the same
// name + PIN, and you land back on the exact same player — same points,
// same standing. The stable key is a normalized slug of the name.

export const NAME_KEY = 'combine_name';
export const PIN_KEY = 'combine_pin';

// Normalize a display name into a Firebase-safe key: trim, lowercase, strip
// accents, collapse spaces, drop characters keys can't contain. So "Léo",
// "leo" and "  LEO " all resolve to the same player.
export function nameKey(name) {
  const key = (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[.#$/[\]]/g, '');
  return key || null;
}

export function getStoredName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function getStoredPin() {
  try {
    return localStorage.getItem(PIN_KEY) || '';
  } catch {
    return '';
  }
}

// Remember who you are and which session you're in, so the app can offer to
// take you straight back after a reload.
export function rememberSession(name, pin) {
  try {
    if (name != null) localStorage.setItem(NAME_KEY, name.trim());
    if (pin) localStorage.setItem(PIN_KEY, pin);
  } catch {
    /* private-mode / storage disabled — non-fatal */
  }
}
