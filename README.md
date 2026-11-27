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

- **Tempo 20–300 BPM**, settable four ways: a slider, a numeric field, six quick-jump buttons
  (40 / 60 / 80 / 120 / 160 / 200), and **tap tempo** — tap the beat a few times and the BPM is
  computed from the average interval.
- **Numerator 1–16**, **denominator 1 / 2 / 4 / 8 / 16 / 32** and **subdivision 1× / 2× / 3× / 4× /
  6× / 8×** are dropdowns — 3/4, 6/8, 7/8, 12/8, 5/16, whatever the page calls for. The denominator is
  notation: it names the note value the pulse stands for, so the subdivision is labelled as a plain
  multiplier (`2×`, `4×`…) and the note it means comes from the denominator.
- **Subdivision**: 1× plays only the pulse; 2× adds one soft click halfway through each pulse, 3× a
  triplet, 4× four clicks per pulse, 6× and 8× the finer divisions. The pulse itself never moves.
- **Accent pattern**: click any beat box to mark it as an accent. The accented beats play a strong,
  higher-pitched click; the rest play the normal click. The first beat is accented by default.
- **Name, «Actualizar preset» and «＋ Crear preset» live in the metronome module**: «Crear preset» saves
  the current tempo/meter/accents as a new preset that appears in the list immediately, and «Actualizar
  preset» overwrites the selected one. A small label says whether the preset is saved or has unsaved
  changes.
- **List**, **select**, **preview one bar** (listen without starting the metronome) and **delete** in the
  Presets panel.
- Editing tempo, meter, denominator or accents **while the metronome is running** takes effect on the
  next beat — no need to stop and restart.

### Tempo track — a map of your piece

The track is a horizontal timeline of **blocks**. Each block carries its own tempo, meter and number
of repeats, and they play back to back.

- **Drag presets from the list onto the timeline** to create a block; the drop position decides where
  it is inserted.
- **＋ Bloque al vuelo** inserts a block using the tempo/meter currently set in the metronome panel —
  handy when you are improvising a form and want to capture it on the spot.
- **Repeats**: drag the right edge of a block to add or remove bars, or type the number in the
  inspector.
- **Per-block tempo, numerator, denominator, subdivision, name** — all editable in the block
  inspector. Tempo and repeats are numeric fields that validate and apply **on blur** (so typing
  «120» does not get clamped to 20 after the first digit); numerator, denominator and subdivision are
  dropdowns.
- **Reorder** blocks by dragging them; **duplicate** and **delete** from the inspector.
- **Play the whole track**, or **start from any block** (button, inspector, or double-click the block).
  Starting from a block puts the playhead at that block, not at the beginning.
- **Loop** the track for endless rehearsal of a passage.
- **Save / list / select / play / delete** tracks: the saved tracks live in their own **Tracks panel**
  (same shape as the Presets panel), while the Track module edits the track that is currently open.

### Visual feedback

- **Beat boxes**: one box per beat of the bar, accented beats in amber, the rest in blue. Each box
  flashes exactly when its click sounds, so you can see the pulse as well as hear it. When the
  subdivision is above 1×, each box shows a dot per extra click that falls inside it.
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

**Tempo, compás y subdivisión.** The BPM is the speed of the pulse: every click lasts
`60 / tempo` seconds, whatever the denominator. The numerator is how many pulses fit in a bar, so a
bar lasts `numerator · 60 / tempo` (6/8 at 100 = six pulses = 3.6 s, 4/4 at 120 = 2 s). The
denominator is **notation**: it names the note value the pulse stands for (4 = negra, 8 = corchea…),
which is what you write on the score, not what the click sounds like. What changes the sound is the
**subdivision**: `1×` plays only the pulse, `2×` adds one soft click at half the pulse, `3×` a
triplet, `4×` sixteenths, `6×` and `8×` the finer divisions. Sub-clicks are scheduled between pulses
with the `soft` sample at low gain, so the pulse, the beat boxes and the pendulum keep marking the
same beats. This matches how the standard metronome apps behave: the denominator is a display
convention and the subdivisions are an independent multiplier per beat.

**Responsive.** The layout is single column below `lg` and the timeline scrolls inside its own
container, so nothing overflows the screen at 390 px.

**Track playback.** Blocks are compiled into segments with their start second, duration and resolved
accent pattern. Playing from a block sets the audio start time so that the playhead begins at that
block's offset. Looping rewinds the segment index and the playhead origin.

## Project layout

| Path | Role |
| --- | --- |
| `src/lib/engine.ts` | Audio engine: `AudioContext`, lookahead scheduler, beat queue, preset/track modes, loop, end of track. |
| `src/lib/types.ts` | `Preset`, `Track`, `TrackBlock` and the time helpers (beat/measure/block durations). |
| `src/lib/storage.ts` | `localStorage` persistence and seed data. |
| `src/lib/metronome-context.tsx` | Global state (presets, tracks, transport) and the `requestAnimationFrame` sync loop. |
| `src/components/MetronomeControls.tsx` | Preset name, save/create, tempo, numerator/denominator/subdivision dropdowns, tap tempo, transport, volume. |
| `src/components/BeatVisualizer.tsx` | Beat boxes, flashing, accent editing. |
| `src/components/Pendulum.tsx` | Analog metronome in SVG. |
| `src/components/PresetPanel.tsx` | Preset list: select, preview, add to track, delete, drag source. |
| `src/components/TrackListPanel.tsx` | Saved tracks: select, play, delete. |
| `src/components/Timeline.tsx` | Timeline: blocks, drag & drop, resize, playhead, zoom, auto-scroll. |
| `src/components/TrackPanel.tsx` | Track open: transport, block inspector. |
| `scripts/generate-sounds.mjs` | Synthesizes the WAV files. |

## Tests

```bash
npm run test:engine   # scheduler logic with a mocked AudioContext: beat sequence, accents, block order,
                      # pulse = 60/BPM regardless of denominator, measure durations, subdivision click
                      # spacing (2× and 4×), loop, starting from a block
npm run test:e2e      # Playwright: render, start/stop, beat flashing (one box at a time, flash only on
                      # the active beat), live tempo changes, denominator does not change the pulse,
                      # subdivision adds real clicks (audio instrumented), accent editing, drag & drop of
                      # presets, block reordering, resize, inspector fields (blur validation, dropdowns),
                      # playhead when starting from a block, auto-scroll behaviour, creating/updating
                      # presets, track panel, saving, persistence after reload, no overflow at 390 px
```

`test:e2e` needs the dev server running. Point it elsewhere with `URL=http://your/host`, and pick a
browser with `BROWSER=chromium` (default is the system Edge channel).

## Tech

Next.js (App Router) · React · TypeScript · Tailwind CSS · Web Audio API · Playwright for the e2e test.
