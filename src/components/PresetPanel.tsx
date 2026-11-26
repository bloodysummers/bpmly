"use client";

import { useMetronome } from "@/lib/metronome-context";
import { Button, Panel } from "./ui";
import type { Preset } from "@/lib/types";

export function PresetPanel() {
  const { presets, draft, selectPreset, deletePreset, previewPreset, addBlockFromPreset, setDraft, savePreset, newPreset } =
    useMetronome();

  return (
    <Panel
      title="Presets"
      right={
        <span className="font-mono text-xs text-muted">
          {presets.length} guardado{presets.length === 1 ? "" : "s"}
        </span>
      }
      className="flex h-full flex-col"
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ name: e.target.value })}
          placeholder="Nombre del preset"
          className="h-8 w-full rounded-md border border-line bg-ink px-2 text-sm outline-none focus:border-accent/60"
        />
        <Button variant="primary" onClick={savePreset} title="Guardar / actualizar el preset actual">
          Guardar
        </Button>
        <Button onClick={newPreset} title="Crear un preset nuevo">
          Nuevo
        </Button>
      </div>

      <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
        {presets.length === 0 && (
          <li className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">
            No hay presets. Configura tempo y compás, y pulsa «Guardar».
          </li>
        )}
        {presets.map((p: Preset) => {
          const active = p.id === draft.id;
          return (
            <li
              key={p.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "preset", id: p.id }));
                e.dataTransfer.effectAllowed = "all";
              }}
              className={`group flex items-center gap-1.5 rounded-lg border px-2 py-2 transition-colors ${
                active ? "border-accent/60 bg-accent/10" : "border-line bg-panel-2 hover:border-muted/40"
              }`}
            >
              <span className="shrink-0 cursor-grab text-muted" title="Arrastra al track">
                ⠿
              </span>
              <button
                type="button"
                onClick={() => selectPreset(p.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="shrink-0 font-mono text-xs text-muted">
                  {p.tempo}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <span className="shrink-0 font-mono text-sm text-beat">
                  {p.numerator}/{p.denominator}
                </span>
              </button>
              <div className="flex shrink-0 gap-1 opacity-70 group-hover:opacity-100">
                <Button variant="ghost" size="sm" onClick={() => previewPreset(p)} title="Escuchar">
                  ▶
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addBlockFromPreset(p)} title="Añadir al track">
                  ＋
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deletePreset(p.id)} title="Eliminar">
                  ✕
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Arrastra un preset a la línea de tiempo del track, o usa ＋ para añadirlo al final.
      </p>
    </Panel>
  );
}
