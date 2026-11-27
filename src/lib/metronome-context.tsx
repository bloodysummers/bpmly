"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getEngine, type BeatEvent, type SoundName } from "./engine";
import {
  makeBlock,
  makePreset,
  uid,
  type Preset,
  type Track,
  type TrackBlock,
} from "./types";
import { loadPresets, loadTracks, savePresets, saveTracks, seedData } from "./storage";

interface MetronomeCtx {
  // datos
  presets: Preset[];
  tracks: Track[];
  draft: Preset;
  currentTrack: Track;
  selectedBlockId: string | null;

  // transporte
  isPlaying: boolean;
  mode: "preset" | "track";
  volume: number;
  loop: boolean;

  // estado visual
  currentBeat: BeatEvent | null;
  beatKey: number;
  playhead: number;
  phase: number;

  // acciones sobre el preset
  setDraft: (patch: Partial<Preset>) => void;
  toggleAccent: (index: number) => void;
  savePreset: () => void;
  createPreset: () => void;
  deletePreset: (id: string) => void;
  selectPreset: (id: string) => void;
  startPreset: () => void;
  /** Preset guardado que coincide con el draft actual (null si el draft no está guardado) */
  savedPreset: Preset | null;
  /** true si el draft tiene cambios respecto al preset guardado */
  presetDirty: boolean;

  // acciones sobre el track
  setCurrentTrack: (patch: Partial<Track>) => void;
  addBlockFromPreset: (preset: Preset) => void;
  addBlockFromDraft: () => void;
  updateBlock: (id: string, patch: Partial<TrackBlock>) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  insertBlockAt: (index: number, preset: Preset) => void;
  selectBlock: (id: string | null) => void;
  saveTrack: () => void;
  newTrack: () => void;
  deleteTrack: (id: string) => void;
  selectTrack: (id: string) => void;
  startTrack: (startIndex?: number) => void;
  /** Selecciona un track guardado y lo reproduce desde el principio */
  playTrack: (id: string) => void;

  stop: () => void;
  setVolume: (v: number) => void;
  setLoop: (v: boolean) => void;
  preview: (name?: SoundName) => void;
  previewPreset: (p: Preset) => void;
}

const MetronomeContext = createContext<MetronomeCtx | null>(null);

export function useMetronome(): MetronomeCtx {
  const ctx = useContext(MetronomeContext);
  if (!ctx) throw new Error("useMetronome debe usarse dentro de MetronomeProvider");
  return ctx;
}

export function MetronomeProvider({ children }: { children: ReactNode }) {
  const engine = getEngine();

  // Inicializadores perezosos: leen localStorage en cliente; en SSR caen al seed determinista
  const [presets, setPresets] = useState<Preset[]>(() => {
    const stored = loadPresets();
    if (stored.length > 0) return stored;
    const seeded = seedData().presets;
    savePresets(seeded);
    return seeded;
  });
  const [tracks, setTracks] = useState<Track[]>(() => {
    const stored = loadTracks();
    if (stored.length > 0) return stored;
    const seeded = seedData().tracks;
    saveTracks(seeded);
    return seeded;
  });
  const [draft, setDraftState] = useState<Preset>(() => {
    const p = loadPresets()[0];
    return p ? structuredClone(p) : makePreset({ id: "draft", name: "Preset sin nombre", createdAt: 0 });
  });
  const [currentTrack, setCurrentTrackState] = useState<Track>(() => {
    const t = loadTracks()[0];
    return t ? structuredClone(t) : { id: "track-local", name: "Track sin nombre", blocks: [], createdAt: 0 };
  });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<"preset" | "track">("preset");
  const [volume, setVolumeState] = useState(0.8);
  const [loop, setLoopState] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<BeatEvent | null>(null);
  const [beatKey, setBeatKey] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [phase, setPhase] = useState(0);

  // Persistencia
  useEffect(() => savePresets(presets), [presets]);
  useEffect(() => saveTracks(tracks), [tracks]);

  // Sincroniza el preset con el motor: los cambios de tempo/compás/acentos surten
  // efecto en el siguiente beat, sin necesidad de parar y volver a iniciar
  useEffect(() => {
    engine.setPreset(draft);
  }, [engine, draft]);

  // Bucle de sincronización visual (rAF)
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const events = engine.drain();
      if (events.length > 0) {
        setCurrentBeat(events[events.length - 1]);
        setBeatKey((k) => k + 1);
      }
      setPhase(engine.phase());
      if (engine.currentMode === "track") setPlayhead(engine.playhead());
      if (!engine.isPlaying) {
        setIsPlaying(false);
        setPlayhead(0);
        setPhase(0);
        setCurrentBeat(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, engine]);

  const presetsById = useMemo(() => {
    const m = new Map<string, Preset>();
    for (const p of presets) m.set(p.id, p);
    return m;
  }, [presets]);

  const stop = useCallback(() => {
    engine.stop();
    setIsPlaying(false);
    setPlayhead(0);
    setPhase(0);
    setCurrentBeat(null);
  }, [engine]);

  const setDraft = useCallback((patch: Partial<Preset>) => {
    setDraftState((d) => {
      const next = { ...d, ...patch };
      if (patch.numerator !== undefined) {
        const n = patch.numerator;
        const pattern = [...next.accentPattern];
        pattern.length = n;
        for (let i = 0; i < n; i++) if (pattern[i] === undefined) pattern[i] = i === 0;
        next.accentPattern = pattern;
      }
      return next;
    });
  }, []);

  const toggleAccent = useCallback((index: number) => {
    setDraftState((d) => {
      const pattern = [...d.accentPattern];
      pattern[index] = !pattern[index];
      return { ...d, accentPattern: pattern };
    });
  }, []);

  const savePreset = useCallback(() => {
    const d = draft;
    setPresets((list) =>
      list.some((p) => p.id === d.id) ? list.map((p) => (p.id === d.id ? { ...d } : p)) : [...list, { ...d }],
    );
  }, [draft]);

  /** Crea un preset nuevo a partir del draft: id nuevo, entra en la lista y queda seleccionado */
  const createPreset = useCallback(() => {
    const fresh: Preset = {
      ...structuredClone(draft),
      id: uid("preset"),
      name: draft.name.trim() || "Preset sin nombre",
      createdAt: Date.now(),
    };
    setPresets((list) => [...list, structuredClone(fresh)]);
    setDraftState(structuredClone(fresh));
  }, [draft]);

  // Preset guardado que corresponde al draft, y si el draft tiene cambios sin guardar
  const savedPreset = presets.find((p) => p.id === draft.id) ?? null;
  const presetDirty =
    !savedPreset || JSON.stringify(savedPreset) !== JSON.stringify({ ...draft, createdAt: savedPreset.createdAt });

  const deletePreset = useCallback((id: string) => {
    setPresets((list) => list.filter((p) => p.id !== id));
  }, []);

  const selectPreset = useCallback(
    (id: string) => {
      const p = presets.find((x) => x.id === id);
      if (p) setDraftState(structuredClone(p));
    },
    [presets],
  );

  const startPreset = useCallback(async () => {
    await engine.startPreset(draft);
    setMode("preset");
    setIsPlaying(engine.isPlaying);
  }, [engine, draft]);

  const setCurrentTrack = useCallback((patch: Partial<Track>) => {
    setCurrentTrackState((t) => ({ ...t, ...patch }));
  }, []);

  const addBlockFromPreset = useCallback((preset: Preset) => {
    setCurrentTrackState((t) => ({
      ...t,
      blocks: [...t.blocks, makeBlock(preset, preset.id, preset.name)],
    }));
  }, []);

  const addBlockFromDraft = useCallback(() => {
    setCurrentTrackState((t) => ({
      ...t,
      blocks: [...t.blocks, makeBlock(draft, null, `${draft.tempo} · ${draft.numerator}/${draft.denominator}`)],
    }));
  }, [draft]);

  const insertBlockAt = useCallback((index: number, preset: Preset) => {
    setCurrentTrackState((t) => {
      const blocks = [...t.blocks];
      blocks.splice(index, 0, makeBlock(preset, preset.id, preset.name));
      return { ...t, blocks };
    });
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<TrackBlock>) => {
    setCurrentTrackState((t) => ({
      ...t,
      blocks: t.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setCurrentTrackState((t) => ({ ...t, blocks: t.blocks.filter((b) => b.id !== id) }));
    setSelectedBlockId((sel) => (sel === id ? null : sel));
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setCurrentTrackState((t) => {
      const idx = t.blocks.findIndex((b) => b.id === id);
      if (idx === -1) return t;
      const copy = { ...t.blocks[idx], id: uid("block") };
      const blocks = [...t.blocks];
      blocks.splice(idx + 1, 0, copy);
      return { ...t, blocks };
    });
  }, []);

  const moveBlock = useCallback((fromIndex: number, toIndex: number) => {
    setCurrentTrackState((t) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return t;
      const blocks = [...t.blocks];
      const [item] = blocks.splice(fromIndex, 1);
      blocks.splice(Math.min(toIndex, blocks.length), 0, item);
      return { ...t, blocks };
    });
  }, []);

  const selectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
  }, []);

  const saveTrack = useCallback(() => {
    const t = currentTrack;
    setTracks((list) =>
      list.some((x) => x.id === t.id)
        ? list.map((x) => (x.id === t.id ? structuredClone(t) : x))
        : [...list, structuredClone(t)],
    );
  }, [currentTrack]);

  const newTrack = useCallback(() => {
    setCurrentTrackState({ id: uid("track"), name: "Track sin nombre", blocks: [], createdAt: Date.now() });
    setSelectedBlockId(null);
    setPlayhead(0);
  }, []);

  const deleteTrack = useCallback((id: string) => {
    setTracks((list) => list.filter((t) => t.id !== id));
  }, []);

  const selectTrack = useCallback(
    (id: string) => {
      const t = tracks.find((x) => x.id === id);
      if (t) setCurrentTrackState(structuredClone(t));
      setSelectedBlockId(null);
      setPlayhead(0);
    },
    [tracks],
  );

  const startTrack = useCallback(
    async (startIndex?: number) => {
      engine.setLoop(loop);
      await engine.startTrack(currentTrack, startIndex ?? 0, presetsById);
      setMode("track");
      setIsPlaying(engine.isPlaying);
    },
    [engine, currentTrack, presetsById, loop],
  );

  const playTrack = useCallback(
    async (id: string) => {
      const t = tracks.find((x) => x.id === id);
      if (!t) return;
      const clone = structuredClone(t);
      setCurrentTrackState(clone);
      setSelectedBlockId(null);
      engine.setLoop(loop);
      await engine.startTrack(clone, 0, presetsById);
      setMode("track");
      setIsPlaying(engine.isPlaying);
    },
    [tracks, engine, presetsById, loop],
  );

  const setVolume = useCallback(
    (v: number) => {
      setVolumeState(v);
      engine.setVolume(v);
    },
    [engine],
  );

  const setLoop = useCallback(
    (v: boolean) => {
      setLoopState(v);
      engine.setLoop(v);
    },
    [engine],
  );

  const preview = useCallback((name: SoundName = "tick") => engine.preview(name), [engine]);
  const previewPreset = useCallback((p: Preset) => engine.previewPreset(p), [engine]);

  const value: MetronomeCtx = {
    presets,
    tracks,
    draft,
    currentTrack,
    selectedBlockId,
    isPlaying,
    mode,
    volume,
    loop,
    currentBeat,
    beatKey,
    playhead,
    phase,
    setDraft,
    toggleAccent,
    savePreset,
    createPreset,
    deletePreset,
    selectPreset,
    startPreset,
    savedPreset,
    presetDirty,
    setCurrentTrack,
    addBlockFromPreset,
    addBlockFromDraft,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    moveBlock,
    insertBlockAt,
    selectBlock,
    saveTrack,
    newTrack,
    deleteTrack,
    selectTrack,
    startTrack,
    playTrack,
    stop,
    setVolume,
    setLoop,
    preview,
    previewPreset,
  };

  return <MetronomeContext.Provider value={value}>{children}</MetronomeContext.Provider>;
}
