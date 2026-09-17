/**
 * The examples on the demo page. Each one's `html` and `js` are both what the
 * page shows and what it runs, so a snippet can never drift from its demo.
 *
 * `js` is written as a consumer would write it, importing from the package.
 * The page swaps that import for the library it was built with (see main.ts).
 */
export interface Example {
  id: string;
  title: string;
  /** Trusted HTML: inline `<code>` is allowed. */
  body: string;
  html: string;
  js?: string;
}

export const examples: Example[] = [
  {
    id: 'sargam',
    title: 'Sargam in any key',
    body: `<p>Set <code>notation="indian"</code> and Sa lands on <code>tonic</code>. Change the
      tonic and every key is relabelled.</p>
      <p>The saptak dots change at Sa, not at C. With Sa on D3, the C3 at the left edge is
      mandra komal Ni: a line and a dot under the same letter.</p>`,
    html: `<cg-keyboard from="C3" to="B4" notation="indian" tonic="D3"></cg-keyboard>`,
  },
  {
    id: 'raag',
    title: 'The notes of a raag',
    body: `<p><code>degrees</code> counts semitones above <code>tonic</code>. This is Bhairav,
      played on a harmonium, which keeps sounding for as long as you hold a key.</p>
      <p>With <code>outside="dim"</code>, keys outside the raag stay playable. That's what an
      ear test needs, since a wrong answer has to be possible. Use
      <code>outside="disable"</code> to rule them out.</p>`,
    html: `<cg-keyboard
  from="C4" to="C6"
  notation="indian"
  degrees="0 1 4 5 7 8 11"
  outside="dim"
  instrument="harmonium"
></cg-keyboard>`,
  },
  {
    id: 'notes',
    title: 'Only certain notes',
    body: `<p><code>notes</code> takes names or MIDI numbers. A name without an octave matches
      that note in every octave; <code>G4</code> or <code>67</code> matches one key.</p>
      <p>The other keys are disabled, and the arrow keys skip over them.</p>`,
    html: `<cg-keyboard from="C4" to="E6" notes="C D E G A" hide-octave></cg-keyboard>`,
  },
  {
    id: 'playback',
    title: 'Light keys during playback',
    body: `<p>Assign pitches to <code>active</code> to light keys from outside, for example in
      time with a melody. Assign a new array each time; changing the same array in place
      won't update the keyboard.</p>
      <p><code>playNote</code> schedules on the audio clock and returns a voice you can stop,
      so pressing play again cuts off the previous run.</p>`,
    html: `<cg-keyboard id="yaman" from="B3" to="C6" notation="indian" follow></cg-keyboard>
<button id="yaman-play">Play the aaroh of Yaman</button>`,
    js: `import { audioContext, playNote } from '@chordialguy/keyboard';

const keyboard = document.querySelector('#yaman');
const aaroh = [59, 62, 64, 66, 69, 71, 72]; // N R G M' D N S'
const step = 0.45;
let voices = [];
let timers = [];

document.querySelector('#yaman-play').addEventListener('click', () => {
  voices.forEach((voice) => voice.stop());
  timers.forEach(clearTimeout);

  const ctx = audioContext();
  if (!ctx) return;
  const start = ctx.currentTime + 0.1;

  voices = aaroh.map((pitch, i) =>
    playNote(pitch, { at: start + i * step, duration: step }),
  );
  timers = aaroh.map((pitch, i) =>
    setTimeout(() => (keyboard.active = [pitch]), (0.1 + i * step) * 1000),
  );
  timers.push(
    setTimeout(() => (keyboard.active = []), (0.1 + aaroh.length * step) * 1000),
  );
});`,
  },
  {
    id: 'answers',
    title: 'Checking answers',
    body: `<p>Listen for <code>cg-note-press</code>. It fires when a tap or click completes.
      <code>cg-note-on</code> fires as the sound starts, including on a touch that turns
      into a scroll, so don't record answers from it.</p>
      <p><code>labels="tonic"</code> labels only Sa, so the learner has to find the note by ear.</p>`,
    html: `<button id="quiz-play">Play a note</button>
<p id="quiz-message">Press play, then find the note on the keyboard.</p>
<cg-keyboard id="quiz" from="C4" to="B4" notation="indian" labels="tonic"></cg-keyboard>`,
    js: `import { playNote } from '@chordialguy/keyboard';

const keyboard = document.querySelector('#quiz');
const message = document.querySelector('#quiz-message');
let target = null;

document.querySelector('#quiz-play').addEventListener('click', () => {
  target = 60 + Math.floor(Math.random() * 12);
  playNote(target);
  message.textContent = 'Which note was that?';
});

keyboard.addEventListener('cg-note-press', (event) => {
  if (target === null) return;
  if (event.detail.pitch === target) {
    message.textContent = 'Correct. Play another one.';
    target = null;
  } else {
    message.textContent = 'Not that one. Try again.';
  }
});`,
  },
  {
    id: 'instruments',
    title: 'Instruments',
    body: `<p>Piano, guitar and harmonium are built in. They're synthesised in the browser,
      so there are no audio files to load and they work offline.</p>
      <p><code>listInstruments()</code> returns every registered instrument, which is enough
      to build a picker.</p>`,
    html: `<label>Instrument <select id="voice"></select></label>
<cg-keyboard id="voiced" from="C3" to="B4"></cg-keyboard>`,
    js: `import { listInstruments } from '@chordialguy/keyboard';

const keyboard = document.querySelector('#voiced');
const picker = document.querySelector('#voice');

for (const [name, label] of listInstruments()) {
  picker.add(new Option(label, name));
}
picker.addEventListener('change', () => {
  keyboard.instrument = picker.value;
});`,
  },
  {
    id: 'custom-instrument',
    title: 'Your own instrument',
    body: `<p><code>registerInstrument</code> adds a voice that every keyboard on the page can
      use by name. <code>play</code> gets the audio context and a note, connects to the dry
      output, the reverb or both, and returns something that can stop it.</p>
      <p><code>releaser</code> builds that return value for most instruments.</p>`,
    html: `<cg-keyboard from="C5" to="B6" instrument="glass"></cg-keyboard>`,
    js: `import { registerInstrument, releaser } from '@chordialguy/keyboard';

registerInstrument('glass', {
  label: 'Glass',
  tapDuration: 1.4,
  play({ ctx, dry, reverb }, { frequency, at, duration, velocity }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3 * velocity, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(gain);
    gain.connect(dry);
    gain.connect(reverb);
    osc.start(at);
    osc.stop(at + duration + 0.05);
    return releaser(ctx, gain, [osc]);
  },
});`,
  },
  {
    id: 'swara',
    title: 'Note names outside the keyboard',
    body: `<p><code>&lt;cg-swara&gt;</code> draws one note name with the same marks the keys use.
      Use it anywhere else a note appears, such as a question or a result, so it matches
      the keyboard.</p>
      <p>The marks are drawn with CSS, so they sit in the same place in any font, and a komal
      note in the mandra saptak shows both its line and its dot.</p>`,
    html: `<div style="display: flex; flex-wrap: wrap; gap: 1.25em; font-size: 44px">
  <cg-swara name="S"></cg-swara>
  <cg-swara name="R" komal saptak="mandra"></cg-swara>
  <cg-swara name="G" komal></cg-swara>
  <cg-swara name="M" tivra saptak="taar"></cg-swara>
  <cg-swara name="F♯" octavelabel="4"></cg-swara>
</div>`,
  },
  {
    id: 'theming',
    title: 'Theming',
    body: `<p>Every size and colour is a <code>--cg-*</code> custom property, set on the
      keyboard or anywhere above it. White keys stop at <code>--cg-key-min-width</code> and
      the keyboard scrolls sideways instead of squeezing them.</p>
      <p>Anything not covered by a property can be styled with <code>::part(key)</code>.</p>`,
    html: `<cg-keyboard class="night" from="C4" to="B5"></cg-keyboard>

<style>
  .night {
    --cg-keyboard-height: 150px;
    --cg-keyboard-background: #14213d;
    --cg-keyboard-padding: 10px;
    --cg-keyboard-radius: 14px;
    --cg-key-gap: 4px;
    --cg-key-radius: 8px;
    --cg-white-key: #e8edf4;
    --cg-white-key-hover: #d6dfea;
    --cg-white-key-border: transparent;
    --cg-black-key: #2c3e66;
    --cg-black-key-hover: #3b5286;
    --cg-key-active: #fca311;
  }
</style>`,
  },
];
