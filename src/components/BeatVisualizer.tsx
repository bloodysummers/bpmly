"use client";

import { useMetronome } from "@/lib/metronome-context";
import { subdivisionLabel } from "@/lib/types";

/**
 * Visualizador de beats: un recuadro por beat del compás.
 * El acento se pinta en color distinto y cada recuadro flashea cuando le toca sonar.
 *
 * La animación se dispara añadiendo la clase solo cuando el beat está activo y
 * la key del recuadro es estable: así la animación corre una sola vez (al
 * activarse) y el recuadro anterior no vuelve a flashear al dejar de sonar.
 */
export function BeatVisualizer({
  editable = false,
  subdivision = 1,
}: {
  editable?: boolean;
  subdivision?: number;
}) {
  const { mode, draft, currentBeat, currentTrack, presets, toggleAccent, isPlaying } =
    useMetronome();

  const numerator = mode === "track" ? (currentBeat?.numerator ?? draft.numerator) : draft.numerator;

  const accentPattern = (() => {
    if (mode === "track") {
      const block = currentBeat ? currentTrack.blocks[currentBeat.blockIndex] : undefined;
      const preset = block?.presetId ? presets.find((p) => p.id === block.presetId) : undefined;
      return preset?.accentPattern ?? Array.from({ length: numerator }, (_, i) => i === 0);
    }
    return draft.accentPattern;
  })();

  const active = currentBeat ? currentBeat.beatInMeasure : -1;
  const canEdit = editable && mode === "preset";
  const repeats = mode === "track" ? (currentBeat ? currentTrack.blocks[currentBeat.blockIndex]?.repeats ?? 1 : 1) : null;
  const measure = currentBeat ? currentBeat.measureInBlock + 1 : 1;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap gap-2"
        style={{ "--beat-count": numerator } as React.CSSProperties}
      >
        {Array.from({ length: numerator }, (_, i) => {
          const isAccent = accentPattern[i] ?? i === 0;
          const isActive = isPlaying && active === i;
          const base = isAccent
            ? "border-accent/70 bg-accent/15 text-accent"
            : "border-beat/40 bg-beat/10 text-beat/80";
          const activeCls = isAccent
            ? "bg-accent text-ink border-accent shadow-[0_0_24px_-2px] shadow-accent/70"
            : "bg-beat text-ink border-beat shadow-[0_0_22px_-2px] shadow-beat/60";
          return (
            <button
              key={i}
              type="button"
              onClick={() => canEdit && toggleAccent(i)}
              title={canEdit ? `Beat ${i + 1}: clic para alternar acento` : `Beat ${i + 1}`}
              className={`flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 font-mono text-lg font-bold transition-colors ${base} ${isActive ? `beat-flash ${activeCls}` : ""} ${canEdit ? "cursor-pointer" : "cursor-default"}`}
            >
              {i + 1}
              {subdivision > 1 && (
                <span className="flex gap-1" aria-hidden>
                  {Array.from({ length: subdivision - 1 }, (_, k) => (
                    <span key={k} className="h-1 w-1 rounded-full bg-current opacity-60" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="font-mono">
          {mode === "track" ? `Compás ${measure}${repeats ? ` / ${repeats}` : ""}` : `Compás ${measure}`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> acento
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-beat/70" /> beat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted/50" /> {subdivisionLabel(subdivision)}
        </span>
        {canEdit && <span className="ml-auto italic opacity-70">clic en un beat para marcar acento</span>}
      </div>
    </div>
  );
}
