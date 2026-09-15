/**
 * @chordialguy/keyboard — the public API, for hosts that bundle (ear-training).
 *
 * Importing this registers `cg-keyboard` and `cg-swara` and the built-in
 * instruments. Hosts without a bundler load `dist/chordialguy-keyboard.iife.js`
 * instead, which exposes the same functions on `window.ChordialGuyKeyboard`.
 */
export { CgKeyboard } from './components/cg-keyboard.js';
export type { KeyLabels, NoteEventDetail, OutsideKeys } from './components/cg-keyboard.js';
export { CgSwara } from './components/cg-swara.js';

export {
  audioContext,
  getInstrument,
  isSupported,
  listInstruments,
  playClick,
  playNote,
  registerInstrument,
  releaser,
  resume,
} from './audio/engine.js';
export type { InstrumentDefinition, NoteRequest, Output, PlayOptions, Voice } from './audio/engine.js';
export { guitar, harmonium, piano } from './audio/instruments.js';

export {
  describeNote,
  SARGAM,
  saptakOf,
  spokenName,
  swaraOf,
} from './notation.js';
export type { Notation, NoteInfo, Saptak, Swara } from './notation.js';

export {
  frequencyOf,
  isBlackKey,
  noteName,
  noteSetHas,
  octaveOf,
  parseDegrees,
  parseNoteName,
  parseNoteSet,
  pitchClassOf,
  pitchName,
  toMidi,
} from './pitch.js';
export type { Midi, NoteSet, NoteSetInput, PitchInput, Spelling } from './pitch.js';
