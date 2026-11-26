"use client";

import { useRef, useState } from "react";
import { useMetronome } from "@/lib/metronome-context";
import { BeatVisualizer } from "./BeatVisualizer";
import { Pendulum } from "./Pendulum";
import { Button, Panel, Stepper } from "./ui";
import { DENOMINATORS, MAX_TEMPO, MIN_TEMPO } from "@/lib/types";

export function MetronomeControls() {
  const {
    draft,
    setDraft,
    isPlaying,
    mode,
    startPreset,
    stop,
    savePreset,
    volume,
    setVolume,
    preview,
    previewPreset,
  } = useMetronome();

  const taps = useRef<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);

  const tap = () => {
    const now = performance.now();
    taps.current = taps.current.filter((t) => now - t < 2500);
    taps.current.push(now);
    if (taps.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.current.length; i++) intervals.push(taps.current[i] - taps.current[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      setTapBpm(bpm);
      setDraft({ tempo: Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, bpm)) });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Panel title="Metrónomo" right={<span className="font-mono text-xs text-muted">{mode === "track" ? "en modo track" : "modo preset"}</span>}>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_150px_110px]">
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-5xl font-bold leading-none text-accent">{Math.round(draft.tempo)}</span>
                <span className="text-xs uppercase tracking-widest text-muted">bpm</span>
              </div>
              <Button onClick={tap} className="ml-auto h-9 px-4">
                Tap tempo
              </Button>
            </div>
            <input
              type="range"
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              step={1}
              value={draft.tempo}
              onChange={(e) => setDraft({ tempo: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex items-center gap-2 text-xs text-muted">
              {[40, 60, 80, 120, 160, 200].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDraft({ tempo: v })}
                  className="rounded border border-line px-1.5 py-0.5 font-mono hover:border-accent/50 hover:text-foreground"
                >
                  {v}
                </button>
              ))}
              {tapBpm && <span className="ml-auto font-mono opacity-70">tap: {tapBpm}</span>}
            </div>
          </div>

          <Stepper
            label="Numerador"
            value={draft.numerator}
            min={1}
            max={16}
            onChange={(v) => setDraft({ numerator: v })}
          />
          <Stepper
            label="Denominador"
            value={draft.denominator}
            min={1}
            max={32}
            onChange={(v) => {
              const allowed = DENOMINATORS.filter((d) => d <= v).pop() ?? 1;
              setDraft({ denominator: allowed });
            }}
          />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <BeatVisualizer editable />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {isPlaying ? (
            <Button variant="danger" onClick={stop} className="px-6 py-2 text-base">
              ■ Detener
            </Button>
          ) : (
            <Button variant="primary" onClick={startPreset} className="px-6 py-2 text-base">
              ▶ Iniciar
            </Button>
          )}
          <Button onClick={() => previewPreset(draft)} disabled={isPlaying}>
            Escuchar compás
          </Button>
          <Button onClick={savePreset}>Guardar preset</Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted">Volumen</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-28"
            />
            <Button variant="ghost" onClick={() => preview("accent")} title="Probar sonido de acento">
              🔊
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Metrónomo analógico">
        <Pendulum />
      </Panel>
    </div>
  );
}
