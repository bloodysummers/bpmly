"use client";

import { useMetronome } from "@/lib/metronome-context";
import { Button, Panel } from "./ui";
import { formatTime, trackDuration } from "@/lib/types";

/**
 * Panel de tracks guardados, igual que el de presets: la lista vive aquí,
 * el track abierto se edita en el módulo de Track.
 */
export function TrackListPanel() {
  const { tracks, currentTrack, selectTrack, deleteTrack, playTrack, isPlaying, mode, stop } = useMetronome();

  return (
    <Panel
      title="Tracks"
      right={
        <span className="font-mono text-xs text-muted">
          {tracks.length} guardados
        </span>
      }
      className="flex h-full flex-col"
    >
      <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
        {tracks.length === 0 && (
          <li className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">
            No hay tracks. Monta bloques en la línea de tiempo y pulsa «Guardar track».
          </li>
        )}
        {tracks.map((t) => {
          const active = t.id === currentTrack.id;
          const playingNow = active && isPlaying && mode === "track";
          return (
            <li
              key={t.id}
              data-testid="track"
              className={`group flex items-center gap-1.5 rounded-lg border px-2 py-2 transition-colors ${
                active ? "border-accent/60 bg-accent/10" : "border-line bg-panel-2 hover:border-muted/40"
              }`}
            >
              <button
                type="button"
                onClick={() => selectTrack(t.id)}
                className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                title="Abrir este track para editarlo"
              >
                <span className="truncate text-sm font-medium">{t.name}</span>
                <span className="flex items-center gap-2 font-mono text-xs text-muted">
                  <span>{t.blocks.length} bloques</span>
                  <span className="text-beat">{formatTime(trackDuration(t.blocks))}</span>
                </span>
              </button>
              <div className="flex shrink-0 gap-1 opacity-70 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (playingNow ? stop() : playTrack(t.id))}
                  disabled={t.blocks.length === 0}
                  title={playingNow ? "Detener" : "Reproducir este track"}
                >
                  {playingNow ? "■" : "▶"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteTrack(t.id)} title="Eliminar">
                  ✕
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Selecciona un track para abrirlo en el módulo de Track. «Guardar track» sobrescribe el track abierto;
        «Nuevo track» abre uno en blanco.
      </p>
    </Panel>
  );
}
