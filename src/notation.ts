/**
 * Notation — what a key is *called*, in Western or Indian (sargam) terms.
 *
 * Western names are **absolute**: C is C whatever the tonic. Sargam is
 * **relative** — Sa *is* the tonic — so the syllables rotate onto it, and the
 * saptak (octave) boundaries sit at Sa rather than at C. Neither changes what a
 * key sounds: a key always plays its own pitch.
 */
import {
  isBlackKey,
  noteName,
  octaveOf,
  pitchClassOf,
  type Midi,
  type Spelling,
} from './pitch.js';

export type Notation = 'western' | 'indian';
export type Saptak = 'mandra' | 'madhya' | 'taar';

export interface Swara {
  /** The bare Bhatkhande letter: S R G M P D N. */
  name: string;
  /** Komal — drawn as a line under the letter. */
  komal: boolean;
  /** Tivra Ma — drawn as a stroke above the letter. */
  tivra: boolean;
}

/**
 * Abbreviated sargam, by semitones above Sa.
 *
 * The accidental marks are kept as *data* rather than baked into the string
 * with combining characters: a combining low line under "N" lands wherever the
 * font decides, and a komal swara an octave down would need two marks stacked
 * below the same letter. `cg-swara` draws them with CSS instead.
 */
export const SARGAM: readonly Swara[] = [
  { name: 'S', komal: false, tivra: false },
  { name: 'R', komal: true, tivra: false },
  { name: 'R', komal: false, tivra: false },
  { name: 'G', komal: true, tivra: false },
  { name: 'G', komal: false, tivra: false },
  { name: 'M', komal: false, tivra: false },
  { name: 'M', komal: false, tivra: true },
  { name: 'P', komal: false, tivra: false },
  { name: 'D', komal: true, tivra: false },
  { name: 'D', komal: false, tivra: false },
  { name: 'N', komal: true, tivra: false },
  { name: 'N', komal: false, tivra: false },
];

const SWARA_SPOKEN: Record<string, string> = {
  S: 'Sa', R: 'Re', G: 'Ga', M: 'Ma', P: 'Pa', D: 'Dha', N: 'Ni',
};

/**
 * Which saptak a pitch falls in, measured **from Sa** — not from C. With Sa at
 * G3 the madhya saptak runs G3–F♯4, so F♯3 takes a dot below and G4 a dot
 * above. Anything further out than one saptak either side still reads as
 * mandra or taar; there is no mark for ati-mandra here.
 */
export function saptakOf(midi: Midi, sa: Midi): Saptak {
  if (midi < sa) return 'mandra';
  if (midi >= sa + 12) return 'taar';
  return 'madhya';
}

export function swaraOf(midi: Midi, sa: Midi): Swara & { saptak: Saptak } {
  return { ...SARGAM[pitchClassOf(midi - sa)], saptak: saptakOf(midi, sa) };
}

/** Everything a host might want to know about one key. */
export interface NoteInfo {
  /** MIDI note number. */
  pitch: Midi;
  /** 0–11, C = 0. */
  pitchClass: number;
  /** Scientific octave: MIDI 60 is octave 4. */
  octave: number;
  /** Western name without octave, in the keyboard's spelling: `"C♯"`. */
  name: string;
  black: boolean;
  /** The same key in sargam, relative to the keyboard's Sa. */
  swara: Swara & { saptak: Saptak };
}

export function describeNote(midi: Midi, sa: Midi, spelling: Spelling = 'sharp'): NoteInfo {
  return {
    pitch: midi,
    pitchClass: pitchClassOf(midi),
    octave: octaveOf(midi),
    name: noteName(midi, spelling),
    black: isBlackKey(midi),
    swara: swaraOf(midi, sa),
  };
}

/**
 * How a note is *spoken*, for aria-labels. Never shown: the marks are spelled
 * out ("komal Ni, mandra saptak") because combining characters read as
 * mojibake to a screen reader.
 */
export function spokenName(note: NoteInfo, notation: Notation): string {
  if (notation === 'western') {
    const spoken = note.name.replace('♯', ' sharp').replace('♭', ' flat');
    return `${spoken} ${note.octave}`;
  }
  const { name, komal, tivra, saptak } = note.swara;
  const prefix = komal ? 'komal ' : tivra ? 'tivra ' : '';
  const suffix = saptak === 'madhya' ? '' : `, ${saptak} saptak`;
  return `${prefix}${SWARA_SPOKEN[name] ?? name}${suffix}`;
}
