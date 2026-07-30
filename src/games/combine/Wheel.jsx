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

// A spinning wheel. `items` is [{ key, label, color }], identical on every
// client. When `spin` changes (new nonce), each client animates so the wedge
// at `targetIndex` ends under the top pointer. `onSettled` fires when it stops.
export default function Wheel({ items, spin, targetIndex, onSettled, icon = '🎡' }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const targetRef = useRef(targetIndex);
  targetRef.current = targetIndex;

  useEffect(() => {
    const s = spinRef.current;
    const index = targetRef.current;
    if (!s || index == null || index < 0 || index >= itemsRef.current.length) {
      return undefined;
    }
    const seg = 360 / itemsRef.current.length;
    const jitter = ((s.nonce % 1000) / 1000 - 0.5) * seg * 0.5;
    const target = -(index + 0.5) * seg + jitter;
    const start = s.at || 0;
    let timer;

    const current = rotationRef.current;
    const delta = ((((target - current) % 360) + 360) % 360) + 4 * 360;
    const next = current + delta;
    rotationRef.current = next;

    const elapsed = Date.now() - start;
    if (elapsed >= SPIN_MS) {
      // Late joiner / reload: show it already settled.
      setRotation(next);
      setSpinning(false);
      onSettledRef.current?.(s);
    } else {
      setSpinning(true);
      setRotation(next);
      timer = setTimeout(() => {
        setSpinning(false);
        onSettledRef.current?.(s);
      }, Math.max(300, SPIN_MS - elapsed));
    }
    return () => timer && clearTimeout(timer);
  }, [spin?.nonce]);

  const seg = 360 / Math.max(items.length, 1);

  return (
    <div className="cmb-wheel">
      <div className="cmb-wheel__pointer" />
      <svg
        viewBox="-104 -104 208 208"
        className="cmb-wheel__disc"
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
              stroke="#0b1220"
              strokeWidth="0.8"
            />
          ))
        )}
        {items.map((it, i) => {
          const mid = (i + 0.5) * seg;
          const [x, y] = polar(mid, R * 0.62);
          return (
            <text
              key={it.key}
              x={x}
              y={y}
              fill="#0b1220"
              fontSize="20"
              fontWeight="900"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${mid - 90} ${x} ${y})`}
            >
              {it.label}
            </text>
          );
        })}
        <circle r="18" fill="#0b1220" stroke="#ffffff" strokeWidth="2" />
        <text x="0" y="1" fontSize="16" textAnchor="middle" dominantBaseline="middle">
          {icon}
        </text>
      </svg>
    </div>
  );
}
