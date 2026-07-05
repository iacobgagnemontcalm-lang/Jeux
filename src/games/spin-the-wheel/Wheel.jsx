import { useEffect, useRef, useState } from 'react';
import { TEAMS } from './teams.js';
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

// The NFL wheel. `teams` is the ordered list of remaining abbreviations
// (identical on every client). When `spin` changes (new nonce), every client
// animates its wheel so the spun team ends up under the top pointer.
export default function Wheel({ teams, spin, onSettled }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  // Read the latest props from refs inside the effect: it must only re-run on
  // a new spin (nonce), never because a parent re-render rebuilt the teams
  // array — that would cancel the settle timer.
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  useEffect(() => {
    const s = spinRef.current;
    if (!s) return undefined;
    const index = teamsRef.current.indexOf(s.team);
    if (index < 0) return undefined;
    const seg = 360 / teamsRef.current.length;
    // Wheel rotation that puts the middle of the target segment at the top
    // pointer, with a deterministic jitter so it doesn't land dead-center.
    const jitter = ((s.nonce % 1000) / 1000 - 0.5) * seg * 0.6;
    const target = -(index + 0.5) * seg + jitter;
    const current = rotationRef.current;
    // At least 4 full extra turns, always forward.
    const delta = ((target - current) % 360 + 360) % 360 + 4 * 360;
    const next = current + delta;
    rotationRef.current = next;

    const elapsed = Date.now() - (s.at || 0);
    if (elapsed >= SPIN_MS) {
      // Late joiner / reload: show it already settled.
      setRotation(next);
      setSpinning(false);
      onSettledRef.current?.(s);
      return undefined;
    }
    setSpinning(true);
    setRotation(next);
    const t = setTimeout(() => {
      setSpinning(false);
      onSettledRef.current?.(s);
    }, Math.max(300, SPIN_MS - elapsed));
    return () => clearTimeout(t);
  }, [spin?.nonce]);

  const seg = 360 / Math.max(teams.length, 1);

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
        {teams.length === 1 ? (
          <circle r={R} fill={TEAMS[teams[0]].color} />
        ) : (
          teams.map((abbr, i) => (
            <path
              key={abbr}
              d={wedgePath(i * seg, (i + 1) * seg)}
              fill={TEAMS[abbr].color}
              stroke="#ffffff"
              strokeWidth="0.6"
            />
          ))
        )}
        {teams.map((abbr, i) => {
          const mid = (i + 0.5) * seg;
          const [x, y] = polar(mid, R * 0.72);
          return (
            <text
              key={abbr}
              x={x}
              y={y}
              fill="#ffffff"
              fontSize={teams.length > 20 ? 8 : 10}
              fontWeight="800"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${mid - 90} ${x} ${y})`}
            >
              {abbr}
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
          🏈
        </text>
      </svg>
    </div>
  );
}
