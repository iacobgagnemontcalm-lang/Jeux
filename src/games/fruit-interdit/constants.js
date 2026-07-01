// --- Fruit Interdit configuration (tune everything here) ---

// Session length in seconds.
export const DURATION_SEC = 240; // 4 minutes

// Combo: entering the same fruit type back-to-back multiplies its points.
// Multiplier = min(comboStreak, MAX_COMBO). A different fruit resets the streak to 1.
export const MAX_COMBO = 5;

// Each fruit: its code prefix, point value, display label and emoji.
// A code is PREFIX + a number (e.g. MAN1, MAN1000). The prefix picks the fruit;
// the number just makes each physical sticker unique.
export const FRUITS = {
  tomato: { prefix: 'TOM', points: 1000, label: 'Tomate', emoji: '🍅' },
  mango: { prefix: 'MAN', points: 600, label: 'Mangue', emoji: '🥭' },
  lemon: { prefix: 'LEM', points: 350, label: 'Citron', emoji: '🍋' },
  lime: { prefix: 'LIM', points: 350, label: 'Citron vert', emoji: '🟢' },
  apple: { prefix: 'APP', points: 200, label: 'Pomme', emoji: '🍎' },
  blueberry: { prefix: 'BLU', points: 100, label: 'Myrtille', emoji: '🫐' },
};

export const FRUIT_KEYS = Object.keys(FRUITS);

// Map of prefix -> fruit key, for fast lookup when parsing a code.
export const PREFIX_TO_FRUIT = Object.fromEntries(
  FRUIT_KEYS.map((key) => [FRUITS[key].prefix, key]),
);
