/**
 * The built-in instruments. Importing this module registers them.
 *
 *   - **piano** — a register-dependent harmonic series through a closing
 *     lowpass, with a two-slope envelope. Ported from the LWCG song player,
 *     where it was measured against a bare triangle (8 audible partials vs 2,
 *     brightness falling 782 → 634 Hz as it decays).
 *   - **guitar** — Karplus-Strong plucked string, with a fractional delay so
 *     it is in tune. Ported from ear-training.
 *   - **harmonium** — two slightly detuned reeds. Sustains while a key is held.
 *
 * A host adds its own with `registerInstrument()`.
 */
import {
  registerInstrument,
  releaser,
  type InstrumentDefinition,
  type Output,
} from './engine.js';

/* ---------------------------------------------------------------- piano --- */

const waveCache = new WeakMap<AudioContext, Map<number, PeriodicWave>>();

/**
 * A piano-ish harmonic series as a PeriodicWave: one oscillator carries the
 * whole timbre, which keeps the node count sane when a song schedules every
 * note up front.
 */
function harmonicWave(ctx: AudioContext, partials: number): PeriodicWave {
  let cache = waveCache.get(ctx);
  if (!cache) waveCache.set(ctx, (cache = new Map()));
  const hit = cache.get(partials);
  if (hit) return hit;

  const real = new Float32Array(partials + 1);
  const imag = new Float32Array(partials + 1);
  for (let n = 1; n <= partials; n++) {
    // Rolloff close to a struck string, with the low partials that give a
    // piano its body nudged up and the very top ones kept from buzzing.
    let amp = Math.pow(n, -1.4);
    if (n === 2) amp *= 1.2;
    if (n === 3) amp *= 1.05;
    if (n > 10) amp *= 0.6;
    imag[n] = amp;
  }
  const wave = ctx.createPeriodicWave(real, imag);
  cache.set(partials, wave);
  return wave;
}

/** Bass strings are far richer than treble ones; a fixed count turns the top shrill. */
function pianoPartials(midi: number): number {
  if (midi < 48) return 18; // below C3
  if (midi < 72) return 12; // C3–B4
  return 7;
}

/** How long a string would ring on its own — low notes far longer. */
function naturalTail(midi: number): number {
  return Math.max(0.7, 9 - (midi - 21) * 0.075);
}

export const piano: InstrumentDefinition = {
  label: 'Piano',
  tapDuration: 0.9,
  play({ ctx, dry, reverb }: Output, { midi, frequency, at, duration, velocity }) {
    const level = 0.4 * velocity;
    // Ring on past the written length, as a released key does, but not so far
    // that a quick run turns to mush.
    const ring = Math.min(Math.max(duration, 0.12) + 0.25, naturalTail(midi));

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(harmonicWave(ctx, pianoPartials(midi)));
    osc.frequency.value = frequency;

    // A real string dulls as it dies away.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(Math.min(frequency * 14 + 900, 13000), at);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(frequency * 2.5, 500),
      at + Math.min(ring, 1.4),
    );

    // Two slopes, as a struck string has: a quick drop as the initial energy
    // goes, then a much gentler tail. One straight exponential to silence made
    // held notes disappear long before they were meant to end.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.004); // hammer
    gain.gain.exponentialRampToValueAtTime(level * 0.35, at + 0.12);
    gain.gain.exponentialRampToValueAtTime(level * 0.1, at + ring * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ring); // damper

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dry);
    gain.connect(reverb);
    osc.start(at);
    osc.stop(at + ring + 0.05);
    return releaser(ctx, gain, [osc]);
  },
};

/* --------------------------------------------------------------- guitar --- */

/** Every pluck is rendered this long and shortened by its envelope. */
const PLUCK_SECONDS = 2.4;

const pluckCache = new WeakMap<AudioContext, Map<number, AudioBuffer>>();

/**
 * Render one plucked string with Karplus-Strong.
 *
 * The delay line's length sets the pitch, but a whole number of samples only
 * expresses certain frequencies — at 440 Hz a 44.1 kHz line rounds 100.2
 * samples to 100 and lands ~26 cents sharp. That is audible, and unacceptable
 * in apps whose whole purpose is pitch, so the read is interpolated between two
 * taps.
 *
 * Buffers are cached per pitch. Rendering one is ~100k samples of arithmetic;
 * a song that schedules every note on Play would otherwise stall on it.
 */
function pluckBuffer(ctx: AudioContext, midi: number, frequency: number): AudioBuffer {
  let cache = pluckCache.get(ctx);
  if (!cache) pluckCache.set(ctx, (cache = new Map()));
  const hit = cache.get(midi);
  if (hit) return hit;

  const rate = ctx.sampleRate;
  const frames = Math.floor(rate * PLUCK_SECONDS);
  const buffer = ctx.createBuffer(1, frames, rate);
  const out = buffer.getChannelData(0);

  // The damping filter averages two samples, which itself delays the loop by
  // half a sample — so aim the delay line half a sample short.
  const target = Math.max(2, rate / frequency - 0.5);
  const taps = Math.floor(target);
  const fraction = target - taps;

  const size = taps + 2;
  const line = new Float32Array(size);
  for (let i = 0; i < size; i++) line[i] = Math.random() * 2 - 1;
  // Soften the excitation so the attack is plucky, not fizzy.
  let smoothed = 0;
  for (let i = 0; i < size; i++) {
    line[i] = (line[i] + smoothed) * 0.5;
    smoothed = line[i];
  }

  const decay = 0.996;
  let write = 0;
  let previous = 0;
  for (let i = 0; i < frames; i++) {
    const near = (write - taps + size * 2) % size;
    const far = (write - taps - 1 + size * 2) % size;
    const read = line[near] * (1 - fraction) + line[far] * fraction;
    // Averaging neighbours is the lowpass that makes high partials die first.
    const value = (read + previous) * 0.5;
    previous = read;
    out[i] = value;
    line[write] = value * decay;
    write = (write + 1) % size;
  }
  cache.set(midi, buffer);
  return buffer;
}

export const guitar: InstrumentDefinition = {
  label: 'Guitar',
  tapDuration: 1.2,
  play({ ctx, dry, reverb }: Output, { midi, frequency, at, duration, velocity }) {
    const source = ctx.createBufferSource();
    source.buffer = pluckBuffer(ctx, midi, frequency);

    // A string keeps ringing after its written length; let it, then damp.
    const end = at + Math.min(Math.max(duration, 0.15) + 0.35, PLUCK_SECONDS);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9 * velocity, at);
    gain.gain.setValueAtTime(0.9 * velocity, end - 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = Math.min(frequency * 10, 7000);

    source.connect(gain);
    gain.connect(body);
    body.connect(dry);
    body.connect(reverb);
    source.start(at);
    source.stop(end + 0.02);
    return releaser(ctx, gain, [source], 0.08);
  },
};

/* ------------------------------------------------------------ harmonium --- */

const reedCache = new WeakMap<AudioContext, PeriodicWave>();

/** A free reed is buzzy — strong, slowly falling harmonics, odd and even alike. */
function reedWave(ctx: AudioContext): PeriodicWave {
  const hit = reedCache.get(ctx);
  if (hit) return hit;
  const partials = 16;
  const real = new Float32Array(partials + 1);
  const imag = new Float32Array(partials + 1);
  for (let n = 1; n <= partials; n++) imag[n] = Math.pow(n, -0.9) * (n === 1 ? 0.7 : 1);
  const wave = ctx.createPeriodicWave(real, imag);
  reedCache.set(ctx, wave);
  return wave;
}

export const harmonium: InstrumentDefinition = {
  label: 'Harmonium',
  tapDuration: 0.7,
  sustains: true,
  play({ ctx, dry, reverb }: Output, { frequency, at, duration, velocity }) {
    const level = 0.13 * velocity;
    const end = at + Math.max(duration, 0.1);

    // Two reeds a few cents apart — the slow beating between them is the
    // harmonium's shimmer.
    const reeds = [-4, 4].map((cents) => {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(reedWave(ctx));
      osc.frequency.value = frequency;
      osc.detune.value = cents;
      return osc;
    });

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(frequency * 7, 6000);
    filter.Q.value = 0.4;

    // Air takes a moment to get a reed speaking, and stops almost at once.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.05);
    gain.gain.setValueAtTime(level, end);
    gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);

    for (const reed of reeds) {
      reed.connect(filter);
      reed.start(at);
      reed.stop(end + 0.15);
    }
    filter.connect(gain);
    gain.connect(dry);
    gain.connect(reverb);
    return releaser(ctx, gain, reeds, 0.12);
  },
};

registerInstrument('piano', piano);
registerInstrument('guitar', guitar);
registerInstrument('harmonium', harmonium);
