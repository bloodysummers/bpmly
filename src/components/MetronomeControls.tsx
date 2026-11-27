"use client";

import { useRef, useState } from "react";
import { useMetronome } from "@/lib/metronome-context";
import { BeatVisualizer } from "./BeatVisualizer";
import { Pendulum } from "./Pendulum";
import { Button, Panel, Select } from "./ui";
import { DENOMINATORS, MAX_TEMPO, MIN_TEMPO, NUMERATORS, SUBDIVISIONS, subdivisionLabel } from "@/lib/types";

export function MetronomeControls() {
  const {
    draft,
    setDraft,
    isPlaying,
    mode,
    startPreset,
    stop,
    savePreset,
    createPreset,
    savedPreset,
    presetDirty,
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
        {/* Nombre del preset y guardado: el preset se define aquí */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            data-testid="Nombre del preset"
            value={draft.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            placeholder="Nombre del preset"
            className="h-8 w-56 rounded-md border border-line bg-ink px-2 text-sm text-foreground outline-none focus:border-accent/60"
          />
          <Button
            variant="primary"
            onClick={savePreset}
            title={savedPreset ? "Sobrescribe el preset seleccionado" : "Guarda el preset actual con este nombre"}
          >
            {savedPreset ? "Actualizar preset" : "Guardar preset"}
          </Button>
          <Button onClick={createPreset} title="Crea un preset nuevo con el tempo, compás y acentos actuales">
            ＋ Crear preset
          </Button>
          <span className="ml-auto text-xs text-muted">
            {savedPreset ? (presetDirty ? "cambios sin guardar" : "guardado") : "preset sin guardar"}
          </span>
        </div>

        {/* Bloque de tempo a ancho completo: los desplegables van en su propia fila, así
            no se enciman cuando el panel es estrecho (breakpoints de 1024–1400) */}
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

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Select
            label="Numerador"
            value={draft.numerator}
            options={NUMERATORS}
            onChange={(v) => setDraft({ numerator: v })}
          />
          <Select
            label="Denominador"
            value={draft.denominator}
            options={DENOMINATORS}
            onChange={(v) => setDraft({ denominator: v })}
          />
          <Select
            label="Subdivisión"
            value={draft.subdivision}
            options={SUBDIVISIONS}
            onChange={(v) => setDraft({ subdivision: v })}
            format={subdivisionLabel}
          />
        </div>

        <p className="mt-2 text-xs text-muted">
          El BPM fija la velocidad del pulso: cada pulsación dura 60/BPM. El numerador son pulsos por
          compás; el denominador solo nombra el valor (notación). La subdivisión añade clics suaves
          entre pulsos.
        </p>

        <div className="mt-5 border-t border-line pt-4">
          <BeatVisualizer editable subdivision={draft.subdivision} />
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
