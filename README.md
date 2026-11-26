# Bpmly

Bpmly is a metronome app built for music that doesn't stay at one speed. Instead of setting a single
tempo and stopping to change it by hand, you can create an entire tempo track: a complete map of the
tempos your piece needs, from the first bar to the last. That means you can practice the way the music
is actually played. Lay out your tempo changes once, press play, and let Bpmly keep time while you
focus on your instrument or your rehearsal. No more pausing mid-song to adjust the speed and losing
your place. You might be working through a piece with shifting sections, preparing music with planned
tempo changes, or simply looking for a steady, dependable click. Either way, Bpmly gives you a clear
and reliable reference for every beat. Set your tempos, trust the timing, and get back to playing.

## Getting started

```bash
npm install
npm run dev
```

Open the local URL that Next.js prints (by default `http://localhost:3000`). The click sounds are
already generated and shipped in `public/sounds/`; to regenerate them:

```bash
npm run sounds
```

Everything you save lives in your browser's `localStorage`, so there is no account, no server and no
setup — your presets and tracks are still there when you come back.

## What it does

### Presets — reusable tempo + meter settings

A preset is a named combination of **tempo**, **numerator** and **denominator**, plus an **accent
pattern** for the bar.

- **Tempo 20–300 BPM**, settable four ways: a slider, a stepper, six quick-jump buttons
  (40 / 60 / 80 / 120 / 160 / 200), and **tap tempo** — tap the beat a few times and the BPM is
  computed from the average interval.
- **Numerator 1–16**, **denominator 1 / 2 / 4 / 8 / 16 / 32** — 3/4, 6/8, 7/8, 12/8, 5/16, whatever
  the page calls for.
- **Accent pattern**: click any beat box to mark it as an accent. The accented beats play a strong,
  higher-pitched click; the rest play the normal click. The first beat is accented by default.
- **Save / update**, **list**, **select**, **preview one bar** (listen without starting the metronome)
  and **delete**.
- Editing tempo, meter or accents **while the metronome is running** takes effect on the next beat —
  no need to stop and restart.

### Tempo track — a map of your piece

The track is a horizontal timeline of **blocks**. Each block carries its own tempo, meter and number
of repeats, and they play back to back.

- **Drag presets from the list onto the timeline** to create a block; the drop position decides where
  it is inserted.
- **＋ Bloque al vuelo** inserts a block using the tempo/meter currently set in the metronome panel —
  handy when you are improvising a form and want to capture it on the spot.
- **Repeats**: drag the right edge of a block to add or remove bars, or type the number in the
  inspector.
- **Per-block tempo, numerator, denominator, name** — all editable in the block inspector.
- **Reorder** blocks by dragging them; **duplicate** and **delete** from the inspector.
- **Play the whole track**, or **start from any block** (button, inspector, or double-click the block).
  Starting from a block puts the playhead at that block, not at the beginning.
- **Loop** the track for endless rehearsal of a passage.
- **Save / list / select / delete** tracks.

### Visual feedback

- **Beat boxes**: one box per beat of the bar, accented beats in amber, the rest in blue. Each box
  flashes exactly when its click sounds, so you can see the pulse as well as hear it.
- **Analog metronome**: a pendulum that swings left and right, reaching an extreme on every beat,
  synced to the real audio. The weight slides up the scale as the tempo rises — short pendulum, fast
  beat — just like a mechanical one.
- **Timeline playhead**: a pink line that advances across the timeline in real time, with the block
  currently playing highlighted, a bar ruler with measure numbers, and a zoom from 0.25× to 4×.
- **Auto-scroll that respects your scrolling**: if you scroll the timeline and the playhead is still
  on screen, your position is kept. If the playhead leaves the view, it is brought back immediately.
  A **Siguiendo / Seguimiento pausado** toggle turns the follow-off entirely so you can read the
  whole form while it plays.

### Keyboard

- `Space` — start / stop.

## How it works

**Audio.** Four WAV files (`accent`, `normal`, `soft`, `tick`) are synthesized offline by
`scripts/generate-sounds.mjs` — 16-bit PCM, 44.1 kHz, a short tone plus a noise transient with an
exponential decay, so the click has a real attack rather than a beep. They are decoded once into
`AudioBuffer`s and played through a master gain node.

**Timing.** The scheduler runs on `AudioContext.currentTime` with a 120 ms lookahead: each tick of a
25 ms interval schedules every beat whose time falls inside the window. Beats are also pushed to a
queue; a `requestAnimationFrame` loop drains the queue and updates the active beat, the pendulum
phase and the playhead. Because the animation reads the same audio clock that the scheduler uses, the
visuals stay locked to the sound and never drift.

**Track playback.** Blocks are compiled into segments with their start second, duration and resolved
accent pattern. Playing from a block sets the audio start time so that the playhead begins at that
block's offset. Looping rewinds the segment index and the playhead origin.

## Project layout

| Path | Role |
| --- | --- |
| `src/lib/engine.ts` | Audio engine: `AudioContext`, lookahead scheduler, beat queue, preset/track modes, loop, end of track. |
| `src/lib/types.ts` | `Preset`, `Track`, `TrackBlock` and the time helpers. |
| `src/lib/storage.ts` | `localStorage` persistence and seed data. |
| `src/lib/metronome-context.tsx` | Global state (presets, tracks, transport) and the `requestAnimationFrame` sync loop. |
| `src/components/MetronomeControls.tsx` | Tempo, numerator, denominator, tap tempo, transport, volume. |
| `src/components/BeatVisualizer.tsx` | Beat boxes, flashing, accent editing. |
| `src/components/Pendulum.tsx` | Analog metronome in SVG. |
| `src/components/PresetPanel.tsx` | Preset list: select, save, preview, delete, drag source. |
| `src/components/Timeline.tsx` | Timeline: blocks, drag & drop, resize, playhead, zoom, auto-scroll. |
| `src/components/TrackPanel.tsx` | Saved tracks, transport, block inspector. |
| `scripts/generate-sounds.mjs` | Synthesizes the WAV files. |

## Tests

```bash
npm run test:engine   # scheduler logic with a mocked AudioContext: beat sequence, accents, block order,
                      # loop, starting from a block
npm run test:e2e      # Playwright: render, start/stop, beat flashing, pendulum movement, live tempo
                      # changes, drag & drop of presets, block reordering, resize, playhead when starting
                      # from a block, auto-scroll behaviour, saving, persistence after reload
```

`test:e2e` needs the dev server running. Point it elsewhere with `URL=http://your/host`, and pick a
browser with `BROWSER=chromium` (default is the system Edge channel).

## Tech

Next.js (App Router) · React · TypeScript · Tailwind CSS · Web Audio API · Playwright for the e2e test.
