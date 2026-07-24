import { useEffect, useRef, useState } from 'react';
import { SPIN_MS } from './constants.js';

const R = 100; // wheel radius in viewBox units

function polar(angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // 0° = 12 o'clock
  return [radius * Math.cos(rad), radius * Math.sin(rad)];
}

function wedgePath(startDeg, endDeg) {
  const [x1, y1] = polar(startDeg, R);
  const [x2, y2] = polar(endDeg, R);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

// A spinning wheel. `items` is the ordered wedge list
// [{ key, label, color }] — identical on every client. When `spin` changes
// (new nonce), every client animates its wheel so the wedge whose key is
// `targetKey` ends up under the top pointer. `delayMs` starts the animation
// that long after the spin was written — the historical mode chains the year
// wheel (delay 0) then the team wheel (delay SPIN_MS). `onSettled` fires when
// THIS wheel stops.
export default function Wheel({
  items,
  spin,
  targetKey,
  onSettled,
  delayMs = 0,
  icon = '🏈',
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  // Read the latest props from refs inside the effect: it must only re-run on
  // a new spin (nonce), never because a parent re-render rebuilt the items
  // array — that would cancel the settle timer.
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const targetRef = useRef(targetKey);
  targetRef.current = targetKey;
  const delayRef = useRef(delayMs);
  delayRef.current = delayMs;

  useEffect(() => {
    const s = spinRef.current;
    if (!s || targetRef.current == null) return undefined;
    const index = itemsRef.current.findIndex(
      (it) => it.key === targetRef.current,
    );
    if (index < 0) return undefined;
    const seg = 360 / itemsRef.current.length;
    // Wheel rotation that puts the middle of the target segment at the top
    // pointer, with a deterministic jitter so it doesn't land dead-center.
    const jitter = ((s.nonce % 1000) / 1000 - 0.5) * seg * 0.6;
    const target = -(index + 0.5) * seg + jitter;
    const start = (s.at || 0) + delayRef.current;
    const timers = [];

    const begin = () => {
      const current = rotationRef.current;
      // At least 4 full extra turns, always forward.
      const delta = ((target - current) % 360 + 360) % 360 + 4 * 360;
      const next = current + delta;
      rotationRef.current = next;

      const elapsed = Date.now() - start;
      if (elapsed >= SPIN_MS) {
        // Late joiner / reload: show it already settled.
        setRotation(next);
        setSpinning(false);
        onSettledRef.current?.(s);
        return;
      }
      setSpinning(true);
      setRotation(next);
      timers.push(
        setTimeout(() => {
          setSpinning(false);
          onSettledRef.current?.(s);
        }, Math.max(300, SPIN_MS - elapsed)),
      );
    };

    const wait = start - Date.now();
    if (wait > 0) timers.push(setTimeout(begin, wait));
    else begin();
    return () => timers.forEach(clearTimeout);
  }, [spin?.nonce]);

  const seg = 360 / Math.max(items.length, 1);

  return (
    <div className="stw-wheel">
      <div className="stw-wheel__pointer" />
      <svg
        viewBox="-104 -104 208 208"
        className="stw-wheel__disc"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.6, 0.08, 1)`
            : 'none',
        }}
      >
        {items.length === 1 ? (
          <circle r={R} fill={items[0].color} />
        ) : (
          items.map((it, i) => (
            <path
              key={it.key}
              d={wedgePath(i * seg, (i + 1) * seg)}
              fill={it.color}
              stroke="#ffffff"
              strokeWidth="0.6"
            />
          ))
        )}
        {items.map((it, i) => {
          const mid = (i + 0.5) * seg;
          const [x, y] = polar(mid, R * 0.72);
          return (
            <text
              key={it.key}
              x={x}
              y={y}
              fill="#ffffff"
              fontSize={items.length > 20 ? 8 : 10}
              fontWeight="800"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${mid - 90} ${x} ${y})`}
            >
              {it.label}
            </text>
          );
        })}
        <circle r="16" fill="#013369" stroke="#ffffff" strokeWidth="2" />
        <text
          x="0"
          y="1"
          fontSize="14"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {icon}
        </text>
      </svg>
    </div>
  );
}
