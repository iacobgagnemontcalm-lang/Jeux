import { PREFIX_TO_FRUIT } from './constants.js';

// Normalise a raw code: uppercase, strip spaces/dashes.
export function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[\s-]/g, '');
}

// Parse a code into its fruit key. Returns { code, fruit } or null if invalid.
// A valid code is LETTERS + DIGITS where LETTERS exactly matches a known prefix.
export function parseCode(raw) {
  const code = normalizeCode(raw);
  const match = code.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const fruit = PREFIX_TO_FRUIT[match[1]];
  if (!fruit) return null;
  return { code, fruit };
}
