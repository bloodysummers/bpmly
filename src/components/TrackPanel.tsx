"use client";

import { useMetronome } from "@/lib/metronome-context";
import { Timeline } from "./Timeline";
import { Button, Field, NumberField, Panel, Select } from "./ui";
import { DENOMINATORS, formatTime, MAX_TEMPO, MIN_TEMPO, NUMERATORS, SUBDIVISIONS, subdivisionLabel, trackDuration } from "@/lib/types";

export function TrackPanel() {
  const {
    currentTrack,
    selectedBlockId,
    setCurrentTrack,
    newTrack,
    saveTrack,
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
      {/* Track abierto: nombre y guardado (la lista de tracks vive en su propio panel) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          data-testid="Nombre del track"
          value={currentTrack.name}
          onChange={(e) => setCurrentTrack({ name: e.target.value })}
          placeholder="Nombre del track"
          className="h-8 w-64 rounded-md border border-line bg-ink px-2 text-sm text-foreground outline-none focus:border-accent/60"
        />
        <Button variant="primary" onClick={saveTrack} title="Sobrescribe el track abierto">
          Guardar track
        </Button>
        <Button onClick={newTrack} title="Abre un track en blanco">
          ＋ Nuevo track
        </Button>
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
      <div data-testid="inspector" className="mt-3 rounded-lg border border-line bg-panel-2 p-3">
        {selected ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Field label="Nombre" value={selected.name} onChange={(v) => updateBlock(selected.id, { name: String(v) })} />
            </div>
            <div className="w-24">
              <NumberField
                label="Tempo"
                min={MIN_TEMPO}
                max={MAX_TEMPO}
                value={selected.tempo}
                onChange={(v) => updateBlock(selected.id, { tempo: v })}
              />
            </div>
            <div className="w-20">
              <Select
                label="Numerador"
                value={selected.numerator}
                options={NUMERATORS}
                onChange={(v) => updateBlock(selected.id, { numerator: v })}
              />
            </div>
            <div className="w-24">
              <Select
                label="Denominador"
                value={selected.denominator}
                options={DENOMINATORS}
                onChange={(v) => updateBlock(selected.id, { denominator: v })}
              />
            </div>
            <div className="w-20">
              <Select
                label="Subdivisión"
                value={selected.subdivision}
                options={SUBDIVISIONS}
                onChange={(v) => updateBlock(selected.id, { subdivision: v })}
                format={subdivisionLabel}
              />
            </div>
            <div className="w-24">
              <NumberField
                label="Repeticiones"
                min={1}
                max={256}
                value={selected.repeats}
                onChange={(v) => updateBlock(selected.id, { repeats: v })}
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
