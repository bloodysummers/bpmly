import type { Preset, Track } from "./types";

const PRESETS_KEY = "metronome.presets.v1";
const TRACKS_KEY = "metronome.tracks.v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o no disponible */
  }
}

export const loadPresets = () =>
  read<Preset>(PRESETS_KEY).map((p) => ({ ...p, subdivision: p.subdivision ?? 1 }));
export const savePresets = (p: Preset[]) => write(PRESETS_KEY, p);
export const loadTracks = () =>
  read<Track>(TRACKS_KEY).map((t) => ({ ...t, blocks: t.blocks.map((b) => ({ ...b, subdivision: b.subdivision ?? 1 })) }));
export const saveTracks = (t: Track[]) => write(TRACKS_KEY, t);

/** Presets y tracks de ejemplo para la primera visita (deterministas: sin Date.now) */
export function seedData(): { presets: Preset[]; tracks: Track[] } {
  const presets: Preset[] = [
    {
      id: "preset_rock",
      name: "Rock 4/4 · 90",
      tempo: 90,
      numerator: 4,
      denominator: 4,
      subdivision: 1,
      accentPattern: [true, false, false, false],
      createdAt: 0,
    },
    {
      id: "preset_waltz",
      name: "Vals 3/4 · 140",
      tempo: 140,
      numerator: 3,
      denominator: 4,
      subdivision: 1,
      accentPattern: [true, false, false],
      createdAt: 0,
    },
    {
      id: "preset_68",
      name: "6/8 · 100",
      tempo: 100,
      numerator: 6,
      denominator: 8,
      subdivision: 1,
      accentPattern: [true, false, false, true, false, false],
      createdAt: 0,
    },
    {
      id: "preset_78",
      name: "7/8 · 130",
      tempo: 130,
      numerator: 7,
      denominator: 8,
      subdivision: 1,
      accentPattern: [true, false, false, false, false, false, false],
      createdAt: 0,
    },
  ];

  const tracks: Track[] = [
    {
      id: "track_demo",
      name: "Demo: intro → verso → puente",
      blocks: [
        { id: "b1", presetId: "preset_waltz", name: "Vals 3/4 · 140", tempo: 140, numerator: 3, denominator: 4, subdivision: 1, repeats: 2 },
        { id: "b2", presetId: "preset_rock", name: "Rock 4/4 · 90", tempo: 90, numerator: 4, denominator: 4, subdivision: 1, repeats: 8 },
        { id: "b3", presetId: "preset_68", name: "6/8 · 100", tempo: 100, numerator: 6, denominator: 8, subdivision: 1, repeats: 4 },
        { id: "b4", presetId: "preset_78", name: "7/8 · 130", tempo: 130, numerator: 7, denominator: 8, subdivision: 1, repeats: 2 },
      ],
      createdAt: 0,
    },
  ];

  return { presets, tracks };
}
