"use client";

import { useMetronome } from "@/lib/metronome-context";
import { Timeline } from "./Timeline";
import { Button, Field, Panel } from "./ui";
import { formatTime, trackDuration } from "@/lib/types";

export function TrackPanel() {
  const {
    currentTrack,
    tracks,
    selectedBlockId,
    setCurrentTrack,
    selectTrack,
    newTrack,
    saveTrack,
    deleteTrack,
    addBlockFromDraft,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    startTrack,
    stop,
    isPlaying,
    mode,
    loop,
    setLoop,
    currentBeat,
  } = useMetronome();

  const selected = currentTrack.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const total = trackDuration(currentTrack.blocks);

  return (
    <Panel
      title="Track"
      right={
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">
            {currentTrack.blocks.length} bloques · {formatTime(total)}
          </span>
        </div>
      }
    >
      {/* Selector de tracks guardados */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={currentTrack.name}
          onChange={(e) => setCurrentTrack({ name: e.target.value })}
          placeholder="Nombre del track"
          className="h-8 w-56 rounded-md border border-line bg-ink px-2 text-sm outline-none focus:border-accent/60"
        />
        <Button variant="primary" onClick={saveTrack}>
          Guardar track
        </Button>
        <Button onClick={newTrack}>Nuevo track</Button>
        <div className="flex flex-wrap gap-1.5">
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTrack(t.id)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                t.id === currentTrack.id ? "border-accent/60 bg-accent/10 text-accent" : "border-line bg-panel-2 hover:border-muted/50"
              }`}
            >
              {t.name}
              <span className="ml-1.5 font-mono opacity-60">{formatTime(trackDuration(t.blocks))}</span>
            </button>
          ))}
        </div>
        {tracks.some((t) => t.id === currentTrack.id) && (
          <Button variant="ghost" onClick={() => deleteTrack(currentTrack.id)} title="Eliminar track guardado">
            ✕
          </Button>
        )}
      </div>

      {/* Transporte */}
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
        {isPlaying && mode === "track" ? (
          <Button variant="danger" onClick={stop}>
            ■ Detener
          </Button>
        ) : (
          <Button variant="primary" onClick={() => startTrack(0)} disabled={currentTrack.blocks.length === 0}>
            ▶ Reproducir track
          </Button>
        )}
        <Button
          onClick={() => startTrack(currentTrack.blocks.findIndex((b) => b.id === selectedBlockId))}
          disabled={!selected || isPlaying}
          title="Empieza a sonar desde el bloque seleccionado"
        >
          ▶ Desde el bloque
        </Button>
        <Button onClick={addBlockFromDraft} title="Inserta un bloque con el tempo/compás actual">
          ＋ Bloque al vuelo
        </Button>
        <label className="ml-3 flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            className="accent-accent"
          />
          Loop
        </label>
        {isPlaying && mode === "track" && currentBeat && (
          <span className="ml-auto font-mono text-xs text-playhead">
            ▸ {currentTrack.blocks[currentBeat.blockIndex]?.name} · compás {currentBeat.measureInBlock + 1} · beat{" "}
            {currentBeat.beatInMeasure + 1}
          </span>
        )}
      </div>

      <Timeline />

      {/* Inspector del bloque */}
      <div className="mt-3 rounded-lg border border-line bg-panel-2 p-3">
        {selected ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Field label="Nombre" value={selected.name} onChange={(v) => updateBlock(selected.id, { name: String(v) })} />
            </div>
            <div className="w-24">
              <Field
                label="Tempo"
                type="number"
                min={20}
                max={300}
                value={selected.tempo}
                onChange={(v) => updateBlock(selected.id, { tempo: Math.max(20, Math.min(300, Number(v) || 20)) })}
              />
            </div>
            <div className="w-20">
              <Field
                label="Numerador"
                type="number"
                min={1}
                max={16}
                value={selected.numerator}
                onChange={(v) => updateBlock(selected.id, { numerator: Math.max(1, Math.min(16, Number(v) || 1)) })}
              />
            </div>
            <div className="w-20">
              <Field
                label="Denominador"
                type="number"
                min={1}
                max={32}
                value={selected.denominator}
                onChange={(v) => updateBlock(selected.id, { denominator: Math.max(1, Number(v) || 1) })}
              />
            </div>
            <div className="w-20">
              <Field
                label="Repeticiones"
                type="number"
                min={1}
                max={256}
                value={selected.repeats}
                onChange={(v) => updateBlock(selected.id, { repeats: Math.max(1, Math.min(256, Number(v) || 1)) })}
              />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="primary" onClick={() => startTrack(currentTrack.blocks.indexOf(selected))}>
                ▶ Desde aquí
              </Button>
              <Button onClick={() => duplicateBlock(selected.id)}>Duplicar</Button>
              <Button variant="danger" onClick={() => deleteBlock(selected.id)}>
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Selecciona un bloque de la línea de tiempo para editar su tempo, compás y repeticiones.
          </p>
        )}
      </div>
    </Panel>
  );
}
