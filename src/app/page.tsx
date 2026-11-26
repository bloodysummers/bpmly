"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { MetronomeProvider, useMetronome } from "@/lib/metronome-context";
import { MetronomeControls } from "@/components/MetronomeControls";
import { PresetPanel } from "@/components/PresetPanel";
import { TrackPanel } from "@/components/TrackPanel";

function Shell() {
  const { isPlaying, startPreset, startTrack, stop, mode, currentTrack } = useMetronome();

  // Render solo en cliente: evita mismatches de hidratación con datos de localStorage
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) stop();
        else if (mode === "track" && currentTrack.blocks.length > 0) startTrack(0);
        else startPreset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlaying, mode, startPreset, startTrack, stop, currentTrack]);

  if (!mounted) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4">
        <p className="text-sm text-muted">Cargando Bpmly…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4">
      <header className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-accent/50 bg-accent/10 text-accent">
            ♩
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Bpmly</h1>
            <p className="text-xs text-muted">Presets + track con cambios de tempo y compás</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-xs text-muted">
            {isPlaying ? "SONANDO" : "DETENIDO"} · {mode}
          </span>
          <span className="hidden text-xs text-muted md:inline">
            <kbd className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono">Espacio</kbd> = iniciar /
            detener
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <MetronomeControls />
        <PresetPanel />
      </div>

      <TrackPanel />

      <footer className="pb-4 text-center text-xs text-muted">
        Presets y tracks se guardan en el navegador (localStorage).
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <MetronomeProvider>
      <Shell />
    </MetronomeProvider>
  );
}
