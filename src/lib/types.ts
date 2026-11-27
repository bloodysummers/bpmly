export interface Preset {
  id: string;
  name: string;
  tempo: number;
  numerator: number;
  denominator: number;
  /** Clics por pulso: 1 = solo el pulso, 2 = corcheas, 3 = tresillo, 4 = semicorcheas… */
  subdivision: number;
  /** Patrón de acentos: true = suena el acento en ese beat (longitud = numerator) */
  accentPattern: boolean[];
  createdAt: number;
}

export interface TrackBlock {
  id: string;
  /** Preset del que proviene el bloque (null si se creó «al vuelo») */
  presetId: string | null;
  name: string;
  tempo: number;
  numerator: number;
  denominator: number;
  /** Clics por pulso (ver Preset.subdivision) */
  subdivision: number;
  /** Cantidad de compases que se repite el bloque */
  repeats: number;
}

export interface Track {
  id: string;
  name: string;
  blocks: TrackBlock[];
  createdAt: number;
}

export const DENOMINATORS = [1, 2, 4, 8, 16, 32];

export const NUMERATORS = Array.from({ length: 16 }, (_, i) => i + 1);

/** Clics por pulso que ofrece la subdivisión */
export const SUBDIVISIONS = [1, 2, 3, 4, 6, 8];

/**
 * Etiqueta de la subdivisión. Se nombra como multiplicador del pulso: el valor
 * que representa cada clic queda implícito en el denominador del compás.
 */
export const subdivisionLabel = (k: number) => `${k}×`;

export const MIN_TEMPO = 20;
export const MAX_TEMPO = 300;

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Duración de una pulsación, en segundos.
 *
 * El BPM es la velocidad del pulso: la pulsación dura siempre 60/tempo, sea
 * cual sea el denominador. El denominador es notación (qué valor representa el
 * pulso), y el numerador dice cuántos pulsos caben en el compás, así que el
 * compás dura numerator × 60/tempo. Lo que cambia el sonido es la subdivisión:
 * los clics extra que caen entre los pulsos.
 */
export function beatDuration(tempo: number): number {
  return 60 / tempo;
}

/** Duración de un compás en segundos */
export function measureDuration(tempo: number, numerator: number): number {
  return numerator * beatDuration(tempo);
}

/** Duración de un bloque en segundos */
export function blockDuration(b: TrackBlock): number {
  return b.repeats * measureDuration(b.tempo, b.numerator);
}

/** Duración total de un track en segundos */
export function trackDuration(blocks: TrackBlock[]): number {
  return blocks.reduce((acc, b) => acc + blockDuration(b), 0);
}

/** Índice acumulado de inicio de cada bloque (en segundos) */
export function blockOffsets(blocks: TrackBlock[]): number[] {
  let acc = 0;
  return blocks.map((b) => {
    const start = acc;
    acc += blockDuration(b);
    return start;
  });
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const cs = Math.floor((seconds - total) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function makePreset(partial: Partial<Preset>): Preset {
  const numerator = partial.numerator ?? 4;
  const accentPattern = partial.accentPattern ?? Array.from({ length: numerator }, (_, i) => i === 0);
  return {
    id: partial.id ?? uid("preset"),
    name: partial.name ?? "Preset",
    tempo: partial.tempo ?? 120,
    numerator,
    denominator: partial.denominator ?? 4,
    subdivision: partial.subdivision ?? 1,
    accentPattern,
    createdAt: partial.createdAt ?? Date.now(),
  };
}

export function makeBlock(
  p: { tempo: number; numerator: number; denominator: number; subdivision?: number },
  presetId: string | null,
  name: string,
): TrackBlock {
  return {
    id: uid("block"),
    presetId,
    name,
    tempo: p.tempo,
    numerator: p.numerator,
    denominator: p.denominator,
    subdivision: p.subdivision ?? 1,
    repeats: 4,
  };
}
