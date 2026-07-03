// --- Fruit Interdit configuration (tune everything here) ---

// Session length in seconds.
export const DURATION_SEC = 600; // 10 minutes

// Combo: entering the same fruit type back-to-back multiplies its points.
// Multiplier = min(comboStreak, MAX_COMBO). A different fruit resets the streak to 1.
export const MAX_COMBO = 5;

// Each fruit: its code prefix, point value, display label and emoji.
// A code is PREFIX + a number (e.g. MAN1, MAN1000). The prefix picks the fruit;
// the number just makes each physical sticker unique.
export const FRUITS = {
  tomato: { prefix: 'TOM', points: 1000, label: 'Tomate', emoji: '🍅' },
  mango: { prefix: 'MAN', points: 600, label: 'Mangue', emoji: '🥭' },
  lime: { prefix: 'LIM', points: 500, label: 'Citron vert', emoji: '🍋‍🟩' },
  lemon: { prefix: 'LEM', points: 350, label: 'Citron', emoji: '🍋' },
  apple: { prefix: 'APP', points: 200, label: 'Pomme', emoji: '🍎' },
  blueberry: { prefix: 'BLU', points: 100, label: 'Myrtille', emoji: '🫐' },
};

export const FRUIT_KEYS = Object.keys(FRUITS);

// Map of prefix -> fruit key, for fast lookup when parsing a code.
export const PREFIX_TO_FRUIT = Object.fromEntries(
  FRUIT_KEYS.map((key) => [FRUITS[key].prefix, key]),
);

// Secret code revealed on a player's screen when they have collected at least
// one fruit of each of the 6 categories, or (for everyone) once only
// SECRET_CODE_REVEAL_SEC seconds remain on the timer.
export const SECRET_CODE = '618';
export const SECRET_CODE_REVEAL_SEC = 240; // 4 minutes remaining

// Special (non-fruit) codes, matched as EXACT codes. Each awards points AND
// broadcasts its own announcement to every player.
export const SPECIAL_CODES = {
  ATY1: { points: 1000, announcement: { emoji: '🐍👶', text: '💙 Monsieur Couleuvre' } },
  ATY2: { points: 1000, announcement: { emoji: '👶', text: '💙 Louphi' } },
  ATY3: { points: 1000, announcement: { emoji: '🧙‍♀️', text: 'La sorcière Charlotte 🔮' } },
  ATY4: { points: 1000, announcement: { emoji: '👶', text: '💗 Lalali' } },
  ATY5: { points: 1000, announcement: { emoji: '🦸', text: '💙 Ozie' } },
  ATY6: { points: 1000, announcement: { emoji: '⛹️‍♂️⚽', text: 'Bébé Guérin 🍼' } },
};
