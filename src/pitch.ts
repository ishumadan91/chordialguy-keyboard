/**
 * Pitch — MIDI numbers, note names, and the sets a keyboard filters by.
 *
 * Everything in this library speaks **MIDI note numbers**: C4 = 60, A4 = 69.
 * The practice apps did not agree on this (ear-training counted
 * `octave × 12 + semitone`, so its C4 was 48), and a shared keyboard is exactly
 * where two numbering schemes collide silently — every note an octave out. One
 * scheme, at the library boundary, with hosts converting on their side.
 */

/** A MIDI note number. */
export type Midi = number;

/** A pitch as a host is likely to have it: `60`, `"C4"`, `"Bb3"`, `"F♯5"`. */
export type PitchInput = Midi | string;

export type Spelling = 'sharp' | 'flat';

const LETTER_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** Letter, optional accidental (ASCII or Unicode), optional octave. */
const NAME_RE = /^([A-Ga-g])(#|♯|b|♭)?(-?\d+)?$/;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export interface ParsedName {
  /** 0–11, C = 0. */
  pitchClass: number;
  /** The absolute pitch, or null when the name carried no octave. */
  midi: Midi | null;
}

/**
 * Read a note name. `"Bb3"` → B♭3 (58), `"F#"` → pitch class 6 with no octave.
 *
 * The flat is applied by arithmetic on the letter, never by stripping the `b`,
 * so B♭3 lands a semitone below B3 rather than on it — and `Cb4` correctly
 * becomes B3.
 */
export function parseNoteName(text: string): ParsedName | null {
  const match = NAME_RE.exec(text.trim());
  if (!match) return null;
  let semitone = LETTER_SEMITONE[match[1].toUpperCase()];
  if (match[2] === '#' || match[2] === '♯') semitone += 1;
  else if (match[2] === 'b' || match[2] === '♭') semitone -= 1;
  const midi = match[3] === undefined ? null : (Number(match[3]) + 1) * 12 + semitone;
  return { pitchClass: mod12(semitone), midi };
}

/** An absolute pitch from a number or a name with an octave; null otherwise. */
export function toMidi(input: PitchInput | null | undefined): Midi | null {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  // An attribute arrives as a string, so "60" must mean MIDI 60.
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return parseNoteName(trimmed)?.midi ?? null;
}

export const pitchClassOf = (midi: Midi): number => mod12(midi);

/** Scientific octave number: MIDI 60 is in octave 4. */
export const octaveOf = (midi: Midi): number => Math.floor(midi / 12) - 1;

export const isBlackKey = (midi: Midi): boolean => BLACK_PITCH_CLASSES.has(mod12(midi));

/** The note's letter and accidental, without an octave: `"C♯"`. */
export function noteName(midi: Midi, spelling: Spelling = 'sharp'): string {
  return (spelling === 'flat' ? FLAT_NAMES : SHARP_NAMES)[mod12(midi)];
}

/** The full name, with octave: `"C♯4"`. */
export function pitchName(midi: Midi, spelling: Spelling = 'sharp'): string {
  return `${noteName(midi, spelling)}${octaveOf(midi)}`;
}

/** Equal-tempered frequency in Hz. */
export function frequencyOf(midi: Midi, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/* ------------------------------------------------------------ note sets --- */

/**
 * A set of notes a keyboard can filter by. Tokens with an octave pin one key
 * (`"C4"`, `60`); tokens without one match that note in every octave (`"C"`).
 */
export interface NoteSet {
  pitches: ReadonlySet<Midi>;
  pitchClasses: ReadonlySet<number>;
}

export type NoteSetInput = string | ReadonlyArray<PitchInput> | null | undefined;

/**
 * Parse `"C D E G4 67"` or `['C', 'D', 60]`. Returns null for "no filter" —
 * an absent or empty input — which is different from a set that matches
 * nothing.
 *
 * An unreadable token is dropped with a console warning rather than thrown:
 * this usually arrives through an HTML attribute, where an exception has
 * nowhere useful to go.
 */
export function parseNoteSet(input: NoteSetInput): NoteSet | null {
  if (input === null || input === undefined) return null;
  const tokens = typeof input === 'string' ? input.split(/[\s,]+/).filter(Boolean) : input;
  if (tokens.length === 0) return null;

  const pitches = new Set<Midi>();
  const pitchClasses = new Set<number>();
  for (const token of tokens) {
    const absolute = toMidi(token);
    if (absolute !== null) {
      pitches.add(absolute);
      continue;
    }
    const parsed = typeof token === 'string' ? parseNoteName(token) : null;
    if (parsed) pitchClasses.add(parsed.pitchClass);
    else console.warn(`@chordialguy/keyboard: ignoring unreadable note "${String(token)}"`);
  }
  return { pitches, pitchClasses };
}

export function noteSetHas(set: NoteSet, midi: Midi): boolean {
  return set.pitches.has(midi) || set.pitchClasses.has(mod12(midi));
}

/**
 * Semitone degrees above a tonic — `"0 2 4 5 7 9 11"` is a major scale, or
 * Bilawal. Null for "no filter". Degrees are notation-agnostic, which is why
 * scales and thaats are best expressed this way rather than as note names.
 */
export function parseDegrees(
  input: string | ReadonlyArray<number> | null | undefined,
): ReadonlySet<number> | null {
  if (input === null || input === undefined) return null;
  const values =
    typeof input === 'string' ? input.split(/[\s,]+/).filter(Boolean).map(Number) : input;
  const degrees = values.filter((d) => Number.isFinite(d)).map((d) => mod12(Math.round(d)));
  return degrees.length ? new Set(degrees) : null;
}
