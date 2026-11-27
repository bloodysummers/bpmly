"use client";

import { useEffect, useRef, useState } from "react";
import { useMetronome } from "@/lib/metronome-context";
import { blockDuration, blockOffsets, formatTime, measureDuration, trackDuration } from "@/lib/types";
import { Button } from "./ui";

const BASE_PX_PER_SEC = 40;
/** Ventana de libertad tras un scroll del usuario: mientras el playhead siga visible,
 * el auto-scroll no lo pisa. Si el playhead se sale de la vista, se recupera al instante. */
const USER_SCROLL_GRACE_MS = 2500;

export function Timeline() {
  const {
    currentTrack,
    selectedBlockId,
    selectBlock,
    updateBlock,
    moveBlock,
    insertBlockAt,
    presets,
    playhead,
    isPlaying,
    mode,
    currentBeat,
    startTrack,
  } = useMetronome();

  const [zoom, setZoom] = useState(1);
  const pxPerSec = BASE_PX_PER_SEC * zoom;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const lastUserScroll = useRef(0);
  const autoScrolling = useRef(false);

  const blocks = currentTrack.blocks;
  const offsets = blockOffsets(blocks);
  const total = trackDuration(blocks);
  const playingBlock = mode === "track" && isPlaying ? currentBeat?.blockIndex : undefined;

  // Auto-scroll: mantiene la cabeza de lectura visible sin bloquear al usuario
  useEffect(() => {
    if (!isPlaying || mode !== "track" || !scrollRef.current || !follow) return;
    const el = scrollRef.current;
    const x = playhead * pxPerSec;
    const view = el.clientWidth;
    const left = el.scrollLeft;
    const inView = x >= left + 24 && x <= left + view - 24;
    const userActive = Date.now() - lastUserScroll.current < USER_SCROLL_GRACE_MS;
    if (!inView) {
      // el playhead se salió de la vista: lo recuperamos y retoma el seguimiento
      autoScrolling.current = true;
      el.scrollLeft = Math.max(0, x - view * 0.4);
      lastUserScroll.current = 0;
    } else if (!userActive && (x < left + view * 0.25 || x > left + view * 0.75)) {
      autoScrolling.current = true;
      el.scrollLeft = Math.max(0, x - view * 0.4);
    }
  }, [playhead, isPlaying, mode, pxPerSec, follow]);

  const indexFromX = (clientX: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    for (let i = 0; i < blocks.length; i++) {
      const start = offsets[i] * pxPerSec;
      const end = start + blockDuration(blocks[i]) * pxPerSec;
      if (x < end) return x < start + (end - start) / 2 ? i : i + 1;
    }
    return blocks.length;
  };

  const startResize = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const block = blocks[index];
    const startRepeats = block.repeats;
    const measureDur = measureDuration(block.tempo, block.numerator);
    const onMove = (ev: PointerEvent) => {
      const deltaSec = (ev.clientX - startX) / pxPerSec;
      const next = Math.max(1, Math.round(startRepeats + deltaSec / measureDur));
      updateBlock(block.id, { repeats: next });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    setDropIndex(null);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { kind: string; id: string };
      const index = indexFromX(e.clientX);
      if (data.kind === "preset") {
        const preset = presets.find((p) => p.id === data.id);
        if (preset) insertBlockAt(index, preset);
      } else if (data.kind === "block") {
        const from = blocks.findIndex((b) => b.id === data.id);
        if (from !== -1) {
          const to = from < index ? index - 1 : index;
          moveBlock(from, to);
        }
      }
    } catch {
      /* ignora datos desconocidos */
    }
  };

  const width = Math.max(total * pxPerSec, 400) + 60;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted sm:gap-3">
        <span className="uppercase tracking-wider">Zoom</span>
        <input
          type="range"
          data-testid="zoom"
          min={0.25}
          max={4}
          step={0.25}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-24 sm:w-40"
        />
        <span className="font-mono">{zoom.toFixed(2)}×</span>
        <span className="ml-auto font-mono">
          {formatTime(isPlaying && mode === "track" ? playhead : 0)} / {formatTime(total)}
        </span>
        <Button
          variant={follow ? "primary" : "default"}
          onClick={() => setFollow((f) => !f)}
          title="La línea de tiempo sigue la cabeza de lectura automáticamente. Puedes desactivarlo y desplazarte libremente."
        >
          {follow ? "Siguiendo" : "Seguimiento pausado"}
        </Button>
      </div>

      <div
        ref={scrollRef}
        onScroll={() => {
          if (autoScrolling.current) autoScrolling.current = false;
          else lastUserScroll.current = Date.now();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropIndex(indexFromX(e.clientX));
        }}
        onDragLeave={() => setDropIndex(null)}
        onDrop={handleDrop}
        data-testid="timeline"
        className="relative min-w-0 overflow-x-auto rounded-lg border border-line bg-ink"
      >
        <div className="relative" style={{ width, height: 158 }}>
          {/* Regla: compases */}
          <div className="absolute inset-x-0 top-0 h-7 border-b border-line">
            {blocks.map((b, i) => {
              const left = offsets[i] * pxPerSec;
              const measureDur = measureDuration(b.tempo, b.numerator);
              const measurePx = measureDur * pxPerSec;
              return (
                <div key={`ruler-${b.id}`} className="absolute top-0 h-full" style={{ left, width: blockDuration(b) * pxPerSec }}>
                  {Array.from({ length: b.repeats }, (_, m) => (
                    <div
                      key={m}
                      className="absolute top-0 flex h-full items-end border-l border-line/60 pl-1"
                      style={{ left: m * measurePx, width: measurePx }}
                    >
                      {measurePx > 26 && (
                        <span className="pb-0.5 font-mono text-[10px] text-muted">
                          {m + 1}
                          {m === 0 ? ` · ${b.tempo}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Bloques */}
          {blocks.map((b, i) => {
            const left = offsets[i] * pxPerSec;
            const w = blockDuration(b) * pxPerSec;
            const selected = b.id === selectedBlockId;
            const playing = playingBlock === i;
            return (
              <div
                key={b.id}
                data-testid="block"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "block", id: b.id }));
                  e.dataTransfer.effectAllowed = "all";
                }}
                onPointerDown={() => selectBlock(b.id)}
                onDoubleClick={() => startTrack(i)}
                className={`absolute top-9 flex cursor-grab flex-col justify-between overflow-hidden rounded-lg border-2 px-2 py-1.5 transition-colors ${
                  playing
                    ? "border-playhead bg-playhead/25"
                    : selected
                      ? "border-accent bg-accent/15"
                      : "border-line bg-panel-2 hover:border-muted/50"
                }`}
                style={{ left, width: Math.max(w, 34), height: 84 }}
                title={`${b.name} — doble clic para reproducir desde aquí`}
              >
                <div className="flex items-center gap-2 truncate text-xs font-semibold">
                  <span className="truncate">{b.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                  <span>{b.tempo}</span>
                  <span className="text-beat">
                    {b.numerator}/{b.denominator}
                  </span>
                  <span className="text-accent">×{b.repeats}</span>
                </div>
                <div className="font-mono text-[10px] opacity-70">{formatTime(blockDuration(b))}</div>
                {/* asa de redimensionado */}
                <div
                  data-testid="resize"
                  onPointerDown={(e) => startResize(e, i)}
                  className="absolute right-0 top-0 flex h-full w-2 cursor-ew-resize items-center justify-center bg-accent/40 text-[8px] text-ink"
                  title="Arrastra para cambiar las repeticiones"
                >
                  ▮
                </div>
              </div>
            );
          })}

          {/* Indicador de inserción */}
          {dropIndex !== null && (
            <div
              className="absolute top-0 h-full w-0.5 bg-accent"
              style={{ left: (dropIndex < blocks.length ? offsets[dropIndex] : total) * pxPerSec }}
            />
          )}

          {/* Playhead */}
          {mode === "track" && isPlaying && (
            <div className="absolute top-0 h-full w-0.5 bg-playhead" style={{ left: playhead * pxPerSec }}>
              <div className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full bg-playhead" />
            </div>
          )}

          {blocks.length === 0 && (
            <div className="absolute inset-x-0 top-[92px] flex justify-center">
              <p className="rounded-lg border border-dashed border-line px-6 py-4 text-center text-sm text-muted">
                Arrastra presets aquí, o usa «＋ Bloque» para insertar uno al vuelo
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
