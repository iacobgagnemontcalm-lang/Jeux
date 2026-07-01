import { PREFIX_TO_FRUIT, SPECIAL_CODES } from './constants.js';

// Normalise a raw code: uppercase, strip spaces/dashes.
export function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[\s-]/g, '');
}

// Parse a code. Returns null if invalid, or one of:
//   { code, kind: 'fruit', fruit }
//   { code, kind: 'special', prefix, special }
// A valid code is LETTERS + DIGITS where LETTERS matches a known prefix.
export function parseCode(raw) {
  const code = normalizeCode(raw);
  const match = code.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  if (PREFIX_TO_FRUIT[prefix]) {
    return { code, kind: 'fruit', fruit: PREFIX_TO_FRUIT[prefix] };
  }
  if (SPECIAL_CODES[prefix]) {
    return { code, kind: 'special', prefix, special: SPECIAL_CODES[prefix] };
  }
  return null;
}
