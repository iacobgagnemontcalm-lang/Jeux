import { useEffect, useState } from 'react';

// Counts down to `endsAt` (ms epoch). Calls onExpire once when time runs out.
export default function Timer({ endsAt, onExpire }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, (endsAt || 0) - Date.now()),
  );

  useEffect(() => {
    if (!endsAt) return undefined;
    let expiredFired = false;
    const tick = () => {
      const ms = Math.max(0, endsAt - Date.now());
      setRemaining(ms);
      if (ms <= 0 && !expiredFired) {
        expiredFired = true;
        onExpire && onExpire();
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  const totalSec = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const low = totalSec <= 30;

  return (
    <div className={`timer${low ? ' timer--low' : ''}`}>
      {mm}:{ss}
    </div>
  );
}
