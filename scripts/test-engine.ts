import { MetronomeEngine, type BeatEvent } from "../src/lib/engine";
import { beatDuration, blockDuration, measureDuration, type Preset, type Track } from "../src/lib/types";

/** Cronología de todos los clics que el motor programa (pulsos + subdivisiones) */
const scheduled: number[] = [];

// Mock mínimo de AudioContext: el tiempo avanza 20x más rápido que el real
class MockAudioContext {
  state = "running";
  destination = {};
  t0 = performance.now();
  get currentTime() {
    return ((performance.now() - this.t0) / 1000) * 20;
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return { gain: { value: 0, setTargetAtTime: () => {} }, connect: () => {} };
  }
  createBufferSource() {
    const rec = {
      buffer: null as unknown,
      connect: () => {},
      start: (t: number) => scheduled.push(t),
      stop: () => {},
    };
    return rec;
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 0.14 } as unknown as AudioBuffer);
  }
}

// @ts-expect-error mock
globalThis.window = { AudioContext: MockAudioContext };
// @ts-expect-error mock
globalThis.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });

const presets: Preset[] = [
  {
    id: "p34",
    name: "Vals",
    tempo: 140,
    numerator: 3,
    denominator: 4,
    subdivision: 1,
    accentPattern: [true, false, false],
    createdAt: 0,
  },
  {
    id: "p44",
    name: "Rock",
    tempo: 90,
    numerator: 4,
    denominator: 4,
    subdivision: 1,
    accentPattern: [true, false, false, false],
    createdAt: 0,
  },
];

const track: Track = {
  id: "t1",
  name: "test",
  createdAt: 0,
  blocks: [
    { id: "b1", presetId: "p34", name: "Vals", tempo: 140, numerator: 3, denominator: 4, subdivision: 1, repeats: 2 },
    { id: "b2", presetId: "p44", name: "Rock", tempo: 90, numerator: 4, denominator: 4, subdivision: 1, repeats: 8 },
    { id: "b3", presetId: null, name: "6/8", tempo: 100, numerator: 6, denominator: 8, subdivision: 1, repeats: 4 },
    { id: "b4", presetId: null, name: "7/8", tempo: 130, numerator: 7, denominator: 8, subdivision: 1, repeats: 2 },
  ],
};

const map = new Map(presets.map((p) => [p.id, p]));

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const failures: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

async function collect(engine: MetronomeEngine, ms: number): Promise<BeatEvent[]> {
  const beats: BeatEvent[] = [];
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const evs = engine.drain();
    beats.push(...evs);
    // al terminar el track, la cola aún tiene beats programados por delante: hay que vaciarla
    if (!engine.isPlaying && evs.length === 0) break;
    await sleep(10);
  }
  return beats;
}

/** Deltas entre clics consecutivos, desde la posición `from` de la cronología */
function clickDeltas(from: number): number[] {
  const xs = scheduled.slice(from);
  return xs.slice(1).map((t, i) => t - xs[i]);
}

async function main() {
  const engine = new MetronomeEngine();

  // ── 1. Track completo: número de beats, acentos, orden de bloques
  console.log("\n[track]");
  await engine.startTrack(track, 0, map);
  const beats = await collect(engine, 4000);
  const expectedBeats = track.blocks.reduce((a, b) => a + b.repeats * b.numerator, 0);
  const expectedAccents = track.blocks.reduce((a, b) => a + b.repeats, 0);
  const accents = beats.filter((b) => b.accent).length;
  const expectedDur = track.blocks.reduce((a, b) => a + blockDuration(b), 0);

  check("beats totales", beats.length === expectedBeats, `${beats.length} vs ${expectedBeats}`);
  check("acentos (1 por compás)", accents === expectedAccents, `${accents} vs ${expectedAccents}`);
  const blockSeq = [...new Set(beats.map((b) => b.blockIndex))].join(",");
  check("orden de bloques", blockSeq === "0,1,2,3", blockSeq);

  // ── 2. Duración del pulso: siempre 60/BPM, el denominador no la cambia
  console.log("\n[duraciones]");
  const intervalsOf = (blockIndex: number) => {
    const idx = beats.map((b, i) => (b.blockIndex === blockIndex ? i : -1)).filter((i) => i >= 0);
    const ds: number[] = [];
    for (let k = 1; k < idx.length; k++) ds.push(beats[idx[k]].time - beats[idx[k - 1]].time);
    return ds;
  };
  const d34 = intervalsOf(0)[0];
  const d68 = intervalsOf(2)[0];
  check("3/4 a 140: pulso = 60/140", near(d34, beatDuration(140), 1e-3), `${d34.toFixed(4)}s`);
  check("6/8 a 100: pulso = 60/100 (el denominador no lo cambia)", near(d68, beatDuration(100), 1e-3), `${d68.toFixed(4)}s`);
  check("6/8 a 100: compás = 6 pulsos = 3.6s", near(measureDuration(100, 6), 3.6, 1e-9), `${measureDuration(100, 6).toFixed(2)}s`);
  check("4/4 a 120: compás = 2s", near(measureDuration(120, 4), 2, 1e-9));
  check(
    "duración del track",
    near(expectedDur, 2 * (3 * (60 / 140)) + 8 * (4 * (60 / 90)) + 4 * (6 * (60 / 100)) + 2 * (7 * (60 / 130)), 1e-9),
    `${expectedDur.toFixed(2)}s`,
  );

  const lastPlayhead = Math.max(0, ...beats.map((b) => b.time)) - beats[0].time;
  console.log(`  playhead final ≈ ${lastPlayhead.toFixed(2)}s, isPlaying=${engine.isPlaying}`);

  // ── 3. Modo preset: acentos, y el denominador no altera la velocidad
  console.log("\n[preset]");
  await engine.startPreset(presets[0]);
  const presetBeats = await collect(engine, 1000);
  const pattern = presetBeats.slice(0, 8).map((b) => (b.accent ? "A" : "x")).join("");
  check("3/4 · 140: patrón de acentos", pattern === "AxxAxxAx", pattern);
  check("phase crece 1 por beat", engine.phase() > 1, engine.phase().toFixed(2));

  await engine.startPreset({ ...presets[0], denominator: 8 });
  const eighth = await collect(engine, 1000);
  const dEighth = eighth[1].time - eighth[0].time;
  check("denominador 8: el pulso sigue siendo 60/140", near(dEighth, beatDuration(140), 1e-3), `${dEighth.toFixed(4)}s`);
  check("3/8 a 140: compás = 3 pulsos = 1.286s", near(measureDuration(140, 3), 1.285714, 1e-6), `${measureDuration(140, 3).toFixed(3)}s`);

  // ── 4. Subdivisión: clics extra entre pulsos, sin cambiar el pulso
  console.log("\n[subdivisión]");
  const sub2Start = scheduled.length;
  await engine.startPreset({ ...presets[0], subdivision: 2 });
  const sub2Beats = await collect(engine, 1000);
  const d2 = clickDeltas(sub2Start);
  const pulse2 = sub2Beats.slice(1).map((b, i) => b.time - sub2Beats[i].time);
  check(
    "2×: un clic extra entre pulsos (intervalo = pulso / 2)",
    d2.length > 0 && d2.every((d) => near(d, beatDuration(140) / 2, 1e-3)),
    `${d2.slice(0, 4).map((d) => d.toFixed(3)).join(" ")} (pulso ${(beatDuration(140) / 2).toFixed(3)}s)`,
  );
  check(
    "2×: el pulso sigue a 60/140",
    pulse2.length > 0 && pulse2.every((d) => near(d, beatDuration(140), 1e-3)),
    `${pulse2.slice(0, 3).map((d) => d.toFixed(3)).join(" ")}`,
  );

  const sub4Start = scheduled.length;
  await engine.startPreset({ ...presets[0], subdivision: 4 });
  const sub4Beats = await collect(engine, 1000);
  const d4 = clickDeltas(sub4Start);
  const pulse4 = sub4Beats.slice(1).map((b, i) => b.time - sub4Beats[i].time);
  check(
    "4×: tres clics extra entre pulsos (intervalo = pulso / 4)",
    d4.length > 0 && d4.every((d) => near(d, beatDuration(140) / 4, 1e-3)),
    `${d4.slice(0, 4).map((d) => d.toFixed(3)).join(" ")} (pulso ${(beatDuration(140) / 4).toFixed(3)}s)`,
  );
  check(
    "4×: el pulso sigue a 60/140",
    pulse4.length > 0 && pulse4.every((d) => near(d, beatDuration(140), 1e-3)),
    `${pulse4.slice(0, 3).map((d) => d.toFixed(3)).join(" ")}`,
  );

  // ── 5. Loop
  console.log("\n[loop]");
  const engine2 = new MetronomeEngine();
  engine2.setLoop(true);
  await engine2.startTrack(track, 0, map);
  const loopBeats = await collect(engine2, 3000);
  const wrapped = loopBeats.some((b, i) => i > 0 && loopBeats[i - 1].blockIndex === 3 && b.blockIndex === 0);
  check(
    "loop: envuelve y sigue sonando",
    engine2.isPlaying && wrapped,
    `beats=${loopBeats.length} último bloque=${loopBeats[loopBeats.length - 1]?.blockIndex}`,
  );

  // ── 6. Empezar desde un bloque
  console.log("\n[desde un bloque]");
  const engine3 = new MetronomeEngine();
  await engine3.startTrack(track, 2, map);
  const fromBeats = await collect(engine3, 1500);
  check("empieza en el bloque pedido", fromBeats[0]?.blockIndex === 2, `primero=${fromBeats[0]?.blockIndex}`);
  check("continúa hasta el final", fromBeats[fromBeats.length - 1]?.blockIndex === 3, `último=${fromBeats[fromBeats.length - 1]?.blockIndex}`);

  engine.stop();
  engine2.stop();
  engine3.stop();

  console.log(failures.length ? `\n❌ motor FAIL (${failures.length})` : `\n✅ motor OK`);
  process.exit(failures.length ? 1 : 0);
}

main();
