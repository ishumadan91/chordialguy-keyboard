/**
 * Audio engine — one Web Audio graph, and a registry of instrument voices.
 *
 * Nothing is sampled: every instrument is synthesised at runtime, so nothing
 * ships but code and it works offline.
 *
 *   voices → master → compressor → speakers
 *          ↘ reverb (a small procedurally generated room) ↗
 *
 * The compressor is there because a chord stacks several voices and the sum
 * would otherwise clip; the room because a dry synthesised tone is what makes
 * it sound lifeless.
 *
 * Browsers keep audio suspended until a user gesture. `playNote` resumes the
 * context itself, so calling it from a pointer handler is enough.
 */
import { frequencyOf, type Midi } from '../pitch.js';

/** A sounding (or scheduled) note, which can be cut short. */
export interface Voice {
  /** Release the note at `at` (default: now). Safe to call more than once. */
  stop(at?: number): void;
}

/** Where a voice connects: `dry` straight out, `reverb` to the room send. */
export interface Output {
  ctx: AudioContext;
  dry: AudioNode;
  reverb: AudioNode;
}

export interface NoteRequest {
  midi: Midi;
  frequency: number;
  /** Context time the note starts. */
  at: number;
  /** Written length in seconds. Instruments may ring on past it, as a real one does. */
  duration: number;
  /** 0–1. */
  velocity: number;
}

export interface InstrumentDefinition {
  /** Human-readable name, for pickers. */
  label: string;
  /** How long a tapped key sounds when nothing says otherwise. */
  tapDuration: number;
  /**
   * True for instruments that hold as long as air or bow keeps going — a
   * harmonium. The keyboard then sounds the note until the key is released,
   * instead of letting it decay on its own.
   */
  sustains?: boolean;
  play(out: Output, note: NoteRequest): Voice;
}

export interface PlayOptions {
  /** Registered instrument name. Default `piano`. */
  instrument?: string;
  /** Context time to start at. Default: now. */
  at?: number;
  /** Seconds. Default: the instrument's tap duration. */
  duration?: number;
  /** 0–1. Default 0.75. */
  velocity?: number;
}

interface EngineState {
  ctx: AudioContext | null;
  output: (Output & { master: GainNode }) | null;
  instruments: Map<string, InstrumentDefinition>;
}

/**
 * Engine state lives on a global, not in module scope. The library can be on
 * a page twice (ear-training's bundle and the standalone script), and two
 * AudioContexts would double the latency setup, fight over the output, and on
 * iOS count against a small per-page limit.
 */
const STATE_KEY = Symbol.for('@chordialguy/keyboard.audio');
const globalScope = globalThis as unknown as Record<symbol, EngineState | undefined>;
const state: EngineState = (globalScope[STATE_KEY] ??= {
  ctx: null,
  output: null,
  instruments: new Map(),
});

const NULL_VOICE: Voice = { stop() {} };

/** True when this environment can produce sound at all. */
export function isSupported(): boolean {
  return typeof window !== 'undefined' && !!audioContextCtor();
}

function audioContextCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/** The shared context, created on first use. Null where there is no Web Audio. */
export function audioContext(): AudioContext | null {
  if (state.ctx) return state.ctx;
  if (typeof window === 'undefined') return null;
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  state.ctx = new Ctor();
  return state.ctx;
}

/**
 * Resume a suspended context. Call from a user gesture.
 *
 * A rejected resume (Safari decides the call wasn't gesture-initiated) must
 * not abort playback — notes still schedule, and the context usually starts on
 * the next real interaction.
 */
export async function resume(): Promise<void> {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'suspended') return;
  try {
    await ctx.resume();
  } catch {
    /* stay suspended; scheduling still proceeds */
  }
}

function roomImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function output(ctx: AudioContext): Output & { master: GainNode } {
  if (state.output && state.output.ctx === ctx) return state.output;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 14;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.22;
  compressor.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(compressor);

  const reverb = ctx.createConvolver();
  reverb.buffer = roomImpulse(ctx, 1.7, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  reverb.connect(wet);
  wet.connect(compressor);

  state.output = { ctx, master, dry: master, reverb };
  return state.output;
}

/* ----------------------------------------------------------- instruments --- */

/** Add an instrument, or replace one. Every keyboard on the page can then use it by name. */
export function registerInstrument(name: string, definition: InstrumentDefinition): void {
  state.instruments.set(name, definition);
}

export function getInstrument(name: string): InstrumentDefinition | undefined {
  return state.instruments.get(name);
}

/** Registered instruments, as `[name, label]` pairs — for building a picker. */
export function listInstruments(): Array<[string, string]> {
  return [...state.instruments].map(([name, def]) => [name, def.label]);
}

const warned = new Set<string>();

function resolveInstrument(name: string): InstrumentDefinition | undefined {
  const found = state.instruments.get(name);
  if (found) return found;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`@chordialguy/keyboard: no instrument "${name}", using piano`);
  }
  return state.instruments.get('piano');
}

/* ---------------------------------------------------------------- public --- */

/**
 * Sound one note, now or at a scheduled time. Returns a voice that can cut it
 * short — which is how a song player silences everything it queued when the
 * learner pauses.
 */
export function playNote(midi: Midi, options: PlayOptions = {}): Voice {
  const ctx = audioContext();
  const instrument = resolveInstrument(options.instrument ?? 'piano');
  if (!ctx || !instrument) return NULL_VOICE;
  void resume();
  return instrument.play(output(ctx), {
    midi,
    frequency: frequencyOf(midi),
    at: options.at ?? ctx.currentTime + 0.005,
    duration: options.duration ?? instrument.tapDuration,
    velocity: Math.min(Math.max(options.velocity ?? 0.75, 0), 1),
  });
}

/**
 * A metronome blip. Pitched well above any melody so it stays audible without
 * competing; the bar's first beat is higher and louder. Sent dry — a click
 * with a tail on it stops being a click.
 */
export function playClick(at?: number, accent = false): Voice {
  const ctx = audioContext();
  if (!ctx) return NULL_VOICE;
  void resume();
  const out = output(ctx);
  const when = at ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const level = accent ? 0.16 : 0.09;
  const release = when + 0.05;

  osc.type = 'square';
  osc.frequency.value = accent ? 1600 : 1100;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(level, when + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, release);

  osc.connect(gain);
  gain.connect(out.dry);
  osc.start(when);
  osc.stop(release + 0.02);
  return releaser(ctx, gain, [osc]);
}

/**
 * A voice that fades `gain` out and stops its sources. Most instruments can use
 * this as-is for their return value.
 */
export function releaser(
  ctx: AudioContext,
  gain: GainNode,
  sources: AudioScheduledSourceNode[],
  releaseSeconds = 0.04,
): Voice {
  let stopped = false;
  return {
    stop(at?: number) {
      if (stopped) return;
      stopped = true;
      const when = Math.max(at ?? ctx.currentTime, ctx.currentTime);
      try {
        gain.gain.cancelScheduledValues(when);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), when);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + releaseSeconds);
        for (const source of sources) source.stop(when + releaseSeconds + 0.01);
      } catch {
        /* already stopped */
      }
    },
  };
}
