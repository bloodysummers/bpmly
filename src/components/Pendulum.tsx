"use client";

import { useMetronome } from "@/lib/metronome-context";

const mapRange = (v: number, a1: number, a2: number, b1: number, b2: number) => {
  const t = (v - a1) / (a2 - a1);
  return b1 + (b2 - b1) * Math.max(0, Math.min(1, t));
};

const PIVOT_X = 110;
const PIVOT_Y = 250;
/** y de la marca de tempo máximo (pesa cerca del pivote) y del tempo mínimo */
const SCALE_TOP = 100;
const SCALE_BOTTOM = 195;

/** Tempo → posición y de la pesa sobre la varilla */
const tempoToY = (tempo: number) => mapRange(tempo, 40, 240, SCALE_BOTTOM, SCALE_TOP);

/**
 * Metrónomo analógico: aguja que oscila de lado a lado, sincronizada con el audio.
 * La aguja llega a un extremo en cada beat (como un metrónomo mecánico).
 * La escala es fija sobre la caja y la pesa se desliza sobre ella.
 */
export function Pendulum() {
  const { phase, isPlaying, draft, mode, currentBeat, beatKey } = useMetronome();
  const tempo = mode === "track" ? (currentBeat?.tempo ?? draft.tempo) : draft.tempo;

  const amplitude = 24;
  const angle = isPlaying ? amplitude * Math.cos(Math.PI * phase) : 0;
  // A mayor tempo, la pesa se acerca al pivote (pendulo más corto = más rápido)
  const weightY = tempoToY(tempo);

  const ticks = [];
  for (let t = 40; t <= 240; t += 10) ticks.push({ y: tempoToY(t), major: t % 20 === 0 });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 300" className="h-[260px] w-full max-w-[260px]">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#222835" />
            <stop offset="100%" stopColor="#12161f" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5a524" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f5a524" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* resplandor del beat */}
        {isPlaying && (
          <circle
            key={beatKey}
            cx={PIVOT_X}
            cy={70}
            r={34}
            fill="url(#glow)"
            className="glow-pulse"
          />
        )}

        {/* cuerpo del metrónomo */}
        <path
          d="M110 40 L170 272 L50 272 Z"
          fill="url(#body)"
          stroke="#2a3140"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect x="46" y="272" width="128" height="14" rx="3" fill="#1b202b" stroke="#2a3140" strokeWidth="2" />

        {/* escala fija sobre la caja, centrada en la varilla */}
        <g stroke="#4a5568" strokeWidth="1.5">
          {ticks.map((tk) => (
            <line
              key={tk.y}
              x1={PIVOT_X - (tk.major ? 11 : 7)}
              y1={tk.y}
              x2={PIVOT_X + (tk.major ? 11 : 7)}
              y2={tk.y}
            />
          ))}
        </g>
        <text x={PIVOT_X} y={SCALE_TOP - 8} textAnchor="middle" fill="#8b95a5" fontSize="9" fontFamily="monospace">
          240
        </text>
        <text x={PIVOT_X} y={SCALE_BOTTOM + 14} textAnchor="middle" fill="#8b95a5" fontSize="9" fontFamily="monospace">
          40
        </text>

        {/* varilla + pesa */}
        <g transform={`rotate(${angle} ${PIVOT_X} ${PIVOT_Y})`}>
          <line
            x1={PIVOT_X}
            y1={PIVOT_Y}
            x2={PIVOT_X}
            y2={44}
            stroke="#e8edf5"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* pesa */}
          <rect
            x={PIVOT_X - 16}
            y={weightY - 7}
            width="32"
            height="14"
            rx="3"
            fill="#f5a524"
            stroke="#8a5a12"
            strokeWidth="1.5"
          />
          <circle cx={PIVOT_X} cy={44} r="5" fill={isPlaying ? "#f5a524" : "#8b95a5"} />
        </g>

        <circle cx={PIVOT_X} cy={PIVOT_Y} r="6" fill="#2a3140" stroke="#e8edf5" strokeWidth="1.5" />

        <text x="110" y="296" textAnchor="middle" fill="#8b95a5" fontSize="11" fontFamily="monospace">
          {Math.round(tempo)} BPM
        </text>
      </svg>
    </div>
  );
}
