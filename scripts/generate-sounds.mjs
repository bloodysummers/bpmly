// Genera los archivos WAV del metrónomo (accent / normal / soft / tick).
// Node ESM: node scripts/generate-sounds.mjs
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SR = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function writeWav(path, samples, sampleRate = SR) {
  const bytesPerSample = 2;
  const data = Buffer.alloc(samples.length * bytesPerSample);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * bytesPerSample);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // tamaño del chunk fmt
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  header.writeUInt16LE(bytesPerSample, 32); // block align
  header.writeUInt16LE(16, 34); // bits por muestra
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

/**
 * Sintetiza un click percusivo: tono senoidal + ráfaga de ruido,
 * con envolvente exponencial y fade-out final para evitar clics.
 */
function click({ freq, decay, duration, noise = 0.25, gain = 1, glide = 0 }) {
  const n = Math.ceil(duration * SR);
  const out = new Float32Array(n);
  let lp = 0; // filtro paso-bajo simple para suavizar el ruido
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t / decay);
    // ligera caída de tono (glide) para un timbre más "madera"
    const f = freq * (1 - glide * t);
    const phase = 2 * Math.PI * (f * t - (glide * freq * t * t) / 2);
    const tone = Math.sin(phase);
    const white = Math.random() * 2 - 1;
    lp = lp * 0.55 + white * 0.45;
    const mixed = tone * (1 - noise) + lp * noise;
    out[i] = gain * env * mixed;
  }
  // fade-out de 4 ms al final
  const fade = Math.round(0.004 * SR);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[n - 1 - i] *= k;
  }
  return out;
}

const sounds = {
  // acento: fuerte, agudo, con cuerpo
  "accent.wav": click({ freq: 1760, decay: 0.055, duration: 0.14, noise: 0.35, gain: 0.95, glide: 0.35 }),
  // beat normal: medio, más grave
  "normal.wav": click({ freq: 1100, decay: 0.038, duration: 0.09, noise: 0.22, gain: 0.55, glide: 0.25 }),
  // beat suave: para subdivisiones / beats secundarios
  "soft.wav": click({ freq: 780, decay: 0.028, duration: 0.07, noise: 0.12, gain: 0.32, glide: 0.2 }),
  // "tick" de referencia para el visualizador (preview corto)
  "tick.wav": click({ freq: 1400, decay: 0.02, duration: 0.05, noise: 0.1, gain: 0.45, glide: 0.15 }),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeWav(join(OUT_DIR, name), samples);
  console.log(`✓ ${name} (${(samples.length / SR).toFixed(3)}s)`);
}

console.log(`\nSonidos generados en: ${OUT_DIR}`);
