import { FRUITS, FRUIT_KEYS } from '../games/fruit-interdit/constants.js';

// Shows how many of each fruit the player has collected, with the fruit's value.
export default function FruitCounts({ counts = {} }) {
  return (
    <div className="fruit-counts">
      {FRUIT_KEYS.map((key) => {
        const fruit = FRUITS[key];
        const n = counts[key] || 0;
        return (
          <div key={key} className={`fruit-chip${n ? ' fruit-chip--has' : ''}`}>
            <span className="fruit-chip__emoji">{fruit.emoji}</span>
            <span className="fruit-chip__count">×{n}</span>
            <span className="fruit-chip__pts">{fruit.points} pts</span>
          </div>
        );
      })}
    </div>
  );
}
