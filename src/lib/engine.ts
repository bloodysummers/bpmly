import { beatDuration, type Preset, type Track, type TrackBlock } from "./types";

export interface Segment {
  blockIndex: number;
  name: string;
  tempo: number;
  numerator: number;
  denominator: number;
  repeats: number;
  accentPattern: boolean[];
  startSeconds: number;
  durationSeconds: number;
}

export interface BeatEvent {
  /** Tiempo del AudioContext en el que suena el beat */
  time: number;
  mode: "preset" | "track";
  blockIndex: number;
  measureInBlock: number;
  beatInMeasure: number;
  beatInBlock: number;
  numerator: number;
  tempo: number;
  accent: boolean;
  beatDur: number;
}

const SOUND_FILES = {
  accent: "/sounds/accent.wav",
  normal: "/sounds/normal.wav",
  soft: "/sounds/soft.wav",
  tick: "/sounds/tick.wav",
} as const;

export type SoundName = keyof typeof SOUND_FILES;

/**
 * Motor de metrónomo con scheduler de lookahead:
 * programa los beats ligeramente por delante del tiempo de audio,
 * y deja una cola de eventos para que la UI se sincronice en rAF.
 */
export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Partial<Record<SoundName, AudioBuffer>> = {};
  private queue: BeatEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  private lookahead = 0.12;
  private tickMs = 25;

  private nextNoteTime = 0;
  private playing = false;
  private mode: "preset" | "track" = "preset";

  private preset: Preset | null = null;
  private segments: Segment[] = [];

  private blockIndex = 0;
  private beatInBlock = 0;
  private beatInMeasure = 0;
  private measureInBlock = 0;

  private trackStart = 0;
  private lastBeatTime = 0;
  private lastBeatDur = 0.5;
  private beatCount = 0;
  private loop = false;
  private ended = false;
  private volume = 0.8;

  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      await this.loadBuffers();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  private async loadBuffers() {
    const ctx = this.ctx!;
    await Promise.all(
      Object.entries(SOUND_FILES).map(async ([name, url]) => {
        const res = await fetch(url);
        const bytes = await res.arrayBuffer();
        this.buffers[name as SoundName] = await ctx.decodeAudioData(bytes);
      }),
    );
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
    }
  }

  get isPlaying() {
    return this.playing;
  }

  get currentMode() {
    return this.mode;
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Beats fraccionales transcurridos (para la aguja del metrónomo) */
  phase(): number {
    if (!this.ctx) return 0;
    const t = this.ctx.currentTime;
    if (!this.playing && this.beatCount === 0) return 0;
    const elapsed = Math.max(0, t - this.lastBeatTime);
    return this.beatCount + elapsed / this.lastBeatDur;
  }

  /** Posición del playhead dentro del track, en segundos */
  playhead(): number {
    if (!this.ctx || this.mode !== "track" || !this.playing) return -1;
    return Math.max(0, this.ctx.currentTime - this.trackStart);
  }

  setLoop(v: boolean) {
    this.loop = v;
  }

  /** Actualiza el preset en caliente: los cambios surten efecto en el siguiente beat. */
  setPreset(preset: Preset) {
    if (this.mode === "preset") this.preset = preset;
  }

  get isLooping() {
    return this.loop;
  }

  /** Devuelve los beats que ya sonaron (tiempo <= currentTime) y actualiza el estado interno. */
  drain(): BeatEvent[] {
    if (!this.ctx) return [];
    const t = this.ctx.currentTime;
    const out: BeatEvent[] = [];
    while (this.queue.length > 0 && this.queue[0].time <= t) {
      const ev = this.queue.shift()!;
      this.lastBeatTime = ev.time;
      this.lastBeatDur = ev.beatDur;
      this.beatCount += 1;
      out.push(ev);
    }
    return out;
  }

  async startPreset(preset: Preset) {
    const ctx = await this.ensure();
    this.stopScheduler();
    this.mode = "preset";
    this.preset = preset;
    this.segments = [];
    this.blockIndex = 0;
    this.beatInMeasure = 0;
    this.measureInBlock = 0;
    this.beatCount = 0;
    this.queue = [];
    this.ended = false;
    this.nextNoteTime = ctx.currentTime + 0.08;
    this.lastBeatTime = this.nextNoteTime;
    this.lastBeatDur = beatDuration(preset.tempo);
    this.playing = true;
    this.startScheduler();
  }

  async startTrack(track: Track, startIndex = 0, presetsById: Map<string, Preset>) {
    const ctx = await this.ensure();
    this.stopScheduler();
    const segments = buildSegments(track.blocks, presetsById);
    if (segments.length === 0) return;
    this.mode = "track";
    this.preset = null;
    this.segments = segments;
    this.blockIndex = Math.min(startIndex, segments.length - 1);
    this.beatInBlock = 0;
    this.beatCount = 0;
    this.queue = [];
    this.ended = false;
    // el playhead debe arrancar en el segundo del bloque inicial, no en 0
    this.trackStart = ctx.currentTime + 0.08 - segments[this.blockIndex].startSeconds;
    this.nextNoteTime = this.trackStart + segments[this.blockIndex].startSeconds;
    this.lastBeatTime = this.nextNoteTime;
    this.lastBeatDur = beatDuration(segments[this.blockIndex].tempo);
    this.playing = true;
    this.startScheduler();
  }

  stop() {
    this.stopScheduler();
    this.playing = false;
    this.queue = [];
    this.beatCount = 0;
  }

  private stopScheduler() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startScheduler() {
    this.stopScheduler();
    this.timer = setInterval(() => this.schedule(), this.tickMs);
    this.schedule();
  }

  private schedule() {
    if (!this.ctx || !this.playing) return;
    const limit = this.ctx.currentTime + this.lookahead;
    let guard = 0;
    while (this.nextNoteTime < limit && guard < 64) {
      guard++;
      const ev = this.buildBeat();
      if (!ev) {
        this.playing = false;
        this.stopScheduler();
        return;
      }
      this.playClick(ev);
      this.queue.push(ev);
      this.nextNoteTime += ev.beatDur;
      this.advance();
    }
  }

  private buildBeat(): BeatEvent | null {
    if (this.ended) return null;
    if (this.mode === "preset") {
      const p = this.preset!;
      const beatDur = beatDuration(p.tempo);
      const accent = p.accentPattern[this.beatInMeasure] ?? this.beatInMeasure === 0;
      return {
        time: this.nextNoteTime,
        mode: "preset",
        blockIndex: 0,
        measureInBlock: this.measureInBlock,
        beatInMeasure: this.beatInMeasure,
        beatInBlock: this.beatInMeasure,
        numerator: p.numerator,
        tempo: p.tempo,
        accent,
        beatDur,
      };
    }

    const seg = this.segments[this.blockIndex];
    if (!seg) return null;
    const beatDur = beatDuration(seg.tempo);
    const beatInMeasure = this.beatInBlock % seg.numerator;
    const accent = seg.accentPattern[beatInMeasure] ?? beatInMeasure === 0;
    return {
      time: this.nextNoteTime,
      mode: "track",
      blockIndex: seg.blockIndex,
      measureInBlock: Math.floor(this.beatInBlock / seg.numerator),
      beatInMeasure,
      beatInBlock: this.beatInBlock,
      numerator: seg.numerator,
      tempo: seg.tempo,
      accent,
      beatDur,
    };
  }

  private advance() {
    if (this.mode === "preset") {
      const p = this.preset!;
      this.beatInMeasure += 1;
      if (this.beatInMeasure >= p.numerator) {
        this.beatInMeasure = 0;
        this.measureInBlock += 1;
      }
      return;
    }

    const seg = this.segments[this.blockIndex];
    const totalBeats = seg.numerator * seg.repeats;
    this.beatInBlock += 1;
    if (this.beatInBlock >= totalBeats) {
      this.beatInBlock = 0;
      this.blockIndex += 1;
      if (this.blockIndex >= this.segments.length) {
        if (this.loop) {
          this.blockIndex = 0;
          this.trackStart = this.nextNoteTime;
        } else {
          // fin del track: la próxima buildBeat() devolverá null y el scheduler se detiene
          this.ended = true;
        }
      }
    }
  }

  private playClick(ev: BeatEvent) {
    if (!this.ctx || !this.master) return;
    const name: SoundName = ev.accent ? "accent" : "normal";
    const buffer = this.buffers[name];
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = ev.accent ? 1 : 0.75;
    src.connect(g);
    g.connect(this.master);
    src.start(ev.time);
    src.stop(ev.time + buffer.duration + 0.05);
  }

  /** Preview inmediato (para probar un sonido desde la UI) */
  async preview(name: SoundName = "tick") {
    const ctx = await this.ensure();
    const buffer = this.buffers[name];
    if (!buffer || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.master);
    src.start(ctx.currentTime + 0.02);
  }

  /** Preview de un compás completo de un preset (para escucharlo antes de usarlo) */
  async previewPreset(preset: Preset) {
    const ctx = await this.ensure();
    const beatDur = beatDuration(preset.tempo);
    const start = ctx.currentTime + 0.08;
    for (let i = 0; i < preset.numerator; i++) {
      const accent = preset.accentPattern[i] ?? i === 0;
      const buffer = this.buffers[accent ? "accent" : "normal"];
      if (!buffer) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = accent ? 1 : 0.75;
      src.connect(g);
      g.connect(this.master!);
      src.start(start + i * beatDur);
    }
  }
}

/** Convierte bloques de un track en segmentos con patrón de acento resuelto */
export function buildSegments(blocks: TrackBlock[], presetsById: Map<string, Preset>): Segment[] {
  let acc = 0;
  return blocks.map((b, i) => {
    const preset = b.presetId ? presetsById.get(b.presetId) : undefined;
    const accentPattern = preset?.accentPattern ?? Array.from({ length: b.numerator }, (_, k) => k === 0);
    const durationSeconds = b.repeats * b.numerator * beatDuration(b.tempo);
    const seg: Segment = {
      blockIndex: i,
      name: b.name,
      tempo: b.tempo,
      numerator: b.numerator,
      denominator: b.denominator,
      repeats: b.repeats,
      accentPattern,
      startSeconds: acc,
      durationSeconds,
    };
    acc += durationSeconds;
    return seg;
  });
}

let engineSingleton: MetronomeEngine | null = null;
export function getEngine(): MetronomeEngine {
  if (!engineSingleton) engineSingleton = new MetronomeEngine();
  return engineSingleton;
}
