import { MetronomeEngine, type BeatEvent } from "../src/lib/engine";
import type { Preset, Track } from "../src/lib/types";

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
    return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} };
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
  { id: "p34", name: "Vals", tempo: 140, numerator: 3, denominator: 4, accentPattern: [true, false, false], createdAt: 0 },
  { id: "p44", name: "Rock", tempo: 90, numerator: 4, denominator: 4, accentPattern: [true, false, false, false], createdAt: 0 },
];

const track: Track = {
  id: "t1",
  name: "test",
  createdAt: 0,
  blocks: [
    { id: "b1", presetId: "p34", name: "Vals", tempo: 140, numerator: 3, denominator: 4, repeats: 2 },
    { id: "b2", presetId: "p44", name: "Rock", tempo: 90, numerator: 4, denominator: 4, repeats: 8 },
    { id: "b3", presetId: null, name: "6/8", tempo: 100, numerator: 6, denominator: 8, repeats: 4 },
    { id: "b4", presetId: null, name: "7/8", tempo: 130, numerator: 7, denominator: 8, repeats: 2 },
  ],
};

const map = new Map(presets.map((p) => [p.id, p]));

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const engine = new MetronomeEngine();
  const beats: BeatEvent[] = [];

  await engine.startTrack(track, 0, map);
  const t0 = performance.now();
  let lastPlayhead = 0;
  while (engine.isPlaying && performance.now() - t0 < 4000) {
    beats.push(...engine.drain());
    lastPlayhead = Math.max(lastPlayhead, engine.playhead());
    await sleep(10);
  }

  const expectedBeats = track.blocks.reduce((a, b) => a + b.repeats * b.numerator, 0);
  const expectedAccents = track.blocks.reduce((a, b) => a + b.repeats, 0); // un acento por compás
  const accents = beats.filter((b) => b.accent).length;

  console.log(`beats: ${beats.length} (esperado ${expectedBeats})`);
  console.log(`acentos: ${accents} (esperado ${expectedAccents})`);
  console.log(`duración track: ${track.blocks.reduce((a, b) => a + b.repeats * b.numerator * (60 / b.tempo), 0).toFixed(2)}s`);
  console.log(`playhead final: ${lastPlayhead.toFixed(2)}s, isPlaying=${engine.isPlaying}`);

  // Secuencia compacta: bloque:beat/numerador
  const seq = beats.map((b) => `${b.blockIndex}:${b.beatInMeasure + 1}/${b.numerator}${b.accent ? "!" : ""}`).join(" ");
  console.log(`secuencia: ${seq}`);

  // Comprobaciones
  const ok = beats.length === expectedBeats && accents === expectedAccents;
  const blockSeq = [...new Set(beats.map((b) => b.blockIndex))].join(",");
  console.log(`orden de bloques: ${blockSeq} (esperado 0,1,2,3)`);

  // Modo preset: 3/4 con acento solo en el beat 1
  const presetBeats: BeatEvent[] = [];
  await engine.startPreset(presets[0]);
  const t1 = performance.now();
  while (engine.isPlaying && performance.now() - t1 < 1000) {
    presetBeats.push(...engine.drain());
    await sleep(10);
  }
  const pattern = presetBeats.slice(0, 8).map((b) => (b.accent ? "A" : "x")).join("");
  console.log(`preset 3/4 · 140: patrón ${pattern} (esperado AxxAxxAx)`);
  console.log(`phase tras 1 beat del preset: ${engine.phase().toFixed(2)} (debe crecer de 0 a 1 por beat)`);

  console.log(ok ? `\n✅ motor OK` : `\n❌ motor FAIL`);

  // Test loop: debe envolver y seguir sonando
  const engine2 = new MetronomeEngine();
  engine2.setLoop(true);
  await engine2.startTrack(track, 0, map);
  const loopBeats: BeatEvent[] = [];
  const t2 = performance.now();
  while (engine2.isPlaying && performance.now() - t2 < 3000) {
    loopBeats.push(...engine2.drain());
    await sleep(10);
  }
  const blocksSeen = [...new Set(loopBeats.map((b) => b.blockIndex))].join(",");
  console.log(`loop: beats=${loopBeats.length} (>76), bloques=${blocksSeen} (debe volver a 0), isPlaying=${engine2.isPlaying}`);

  // Test iniciar desde un bloque concreto
  const engine3 = new MetronomeEngine();
  await engine3.startTrack(track, 2, map);
  const fromBeats: BeatEvent[] = [];
  const t3 = performance.now();
  while (engine3.isPlaying && performance.now() - t3 < 1500) {
    fromBeats.push(...engine3.drain());
    await sleep(10);
  }
  const firstBlock = fromBeats[0]?.blockIndex;
  const lastBlock = fromBeats[fromBeats.length - 1]?.blockIndex;
  console.log(`desde bloque 2: primero=${firstBlock} último=${lastBlock} (esperado 2 → 3)`);

  engine.stop();
  engine2.stop();
  engine3.stop();
  process.exit(0);
}

main();
