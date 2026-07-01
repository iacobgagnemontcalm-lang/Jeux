import { PREFIX_TO_FRUIT, SPECIAL_CODES } from './constants.js';

// Normalise a raw code: uppercase, strip spaces/dashes.
export function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[\s-]/g, '');
}

// Parse a code. Returns null if invalid, or one of:
//   { code, kind: 'fruit', fruit }
//   { code, kind: 'special', special }
// Special codes are matched as exact codes (e.g. ATY3). Fruit codes are a known
// letter prefix + digits (e.g. MAN7).
export function parseCode(raw) {
  const code = normalizeCode(raw);
  if (SPECIAL_CODES[code]) {
    return { code, kind: 'special', special: SPECIAL_CODES[code] };
  }
  const match = code.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const fruit = PREFIX_TO_FRUIT[match[1]];
  if (fruit) {
    return { code, kind: 'fruit', fruit };
  }
  return null;
}
