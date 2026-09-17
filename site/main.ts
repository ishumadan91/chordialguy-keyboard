import * as lib from '../src/index.js';
import type { CgKeyboard, CgSwara, NoteEventDetail } from '../src/index.js';
import { examples, type Example } from './examples.js';

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*'@chordialguy\/keyboard';?\s*$/gm;

/* ------------------------------------------------------------ hero --- */

const hero = document.querySelector<CgKeyboard>('#hero-keyboard')!;
const glyph = document.querySelector<CgSwara>('#readout-glyph')!;
const spoken = document.querySelector<HTMLElement>('#readout-spoken')!;
const midi = document.querySelector<HTMLElement>('#readout-midi')!;
const readout = document.querySelector<HTMLElement>('#readout')!;
const instrument = document.querySelector<HTMLSelectElement>('#hero-instrument')!;
const tonic = document.querySelector<HTMLSelectElement>('#hero-tonic')!;

for (const [name, label] of lib.listInstruments()) instrument.add(new Option(label, name));

let last: NoteEventDetail | null = null;

function showNote(note: NoteEventDetail | null) {
  if (!note) return;
  const indian = hero.notation === 'indian';
  glyph.name = indian ? note.swara.name : note.name;
  glyph.komal = indian && note.swara.komal;
  glyph.tivra = indian && note.swara.tivra;
  glyph.saptak = indian ? note.swara.saptak : null;
  glyph.octaveLabel = indian ? null : note.octave;
  spoken.textContent = lib.spokenName(note, hero.notation);
  midi.textContent = `MIDI ${note.pitch}`;
}

hero.addEventListener('cg-note-on', (event) => {
  last = (event as CustomEvent<NoteEventDetail>).detail;
  showNote(last);
  readout.classList.remove('struck');
  void readout.offsetWidth; // restart the flash
  readout.classList.add('struck');
});

document.querySelector('#hero-controls')!.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.name === 'notation') hero.notation = target.value as 'western' | 'indian';
  if (target === instrument) hero.instrument = instrument.value;
  if (target === tonic) hero.tonic = tonic.value;
  // Re-describe the last note against the new notation or Sa.
  if (last) showNote({ ...last, ...lib.describeNote(last.pitch, lib.toMidi(hero.tonic)!) });
});

/* -------------------------------------------------------- examples --- */

function codeBlock(language: string, source: string): string {
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<figure class="code">
    <figcaption><span>${language}</span><button type="button" class="copy">Copy</button></figcaption>
    <pre><code>${escaped}</code></pre>
  </figure>`;
}

function render(example: Example): HTMLElement {
  const section = document.createElement('section');
  section.className = 'example';
  section.id = example.id;
  section.innerHTML = `
    <div class="example-text">
      <h3><a href="#${example.id}">${example.title}</a></h3>
      ${example.body}
    </div>
    <div class="example-stage">
      <div class="demo">${example.html}</div>
      ${codeBlock('HTML', example.html)}
      ${example.js ? codeBlock('JavaScript', example.js) : ''}
    </div>`;
  return section;
}

/** Run a snippet as shown, with its package import bound to the built library. */
function run(example: Example) {
  if (!example.js) return;
  const body = example.js.replace(IMPORT_RE, 'const {$1} = lib;');
  try {
    new Function('lib', body)(lib);
  } catch (error) {
    console.error(`Example "${example.id}" failed`, error);
  }
}

const list = document.querySelector('#examples-list')!;
const toc = document.querySelector('#examples-toc')!;
for (const example of examples) {
  list.append(render(example));
  run(example);
  const item = document.createElement('li');
  item.innerHTML = `<a href="#${example.id}">${example.title}</a>`;
  toc.append(item);
}

/* ------------------------------------------------------------ copy --- */

document.addEventListener('click', async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button.copy, button.copy-install');
  if (!button) return;
  const code = button.dataset.copy ?? button.closest('.code')!.querySelector('code')!.textContent ?? '';
  try {
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => (button.textContent = 'Copy'), 1600);
});
