# @chordialguy/keyboard

A playable piano keyboard web component — Western or sargam labels, scale and
note filters, lit keys for playback — with synthesised instruments and no
audio assets. Lit + TypeScript. Built for the
[Learn with Chordial Guy](https://github.com/ishumadan91) practice apps.

## Install

```bash
npm install @chordialguy/keyboard lit
```

**With a bundler** — importing registers `<cg-keyboard>` and `<cg-swara>`:

```ts
import '@chordialguy/keyboard';
import { playNote, type NoteEventDetail } from '@chordialguy/keyboard';
```

**Without one** — a single classic script with Lit bundled in, exposing the
API on `window.ChordialGuyKeyboard`. Copy
`node_modules/@chordialguy/keyboard/dist/chordialguy-keyboard.iife.js` into your
static files (it is also the package's `./iife` export):

```html
<script src="chordialguy-keyboard.iife.js"></script>
<cg-keyboard from="C3" to="B4"></cg-keyboard>
```

Used by **ear-training** (`et-piano`, via the bundler) and the **LWCG song
player** (the IIFE, copied by `scripts/sync_learning_app.py
chordialguy-keyboard`).

## Developing

```bash
npm run dev        # playground (index.html) with live controls
npm run storybook  # every configuration, on :6007
npm run build      # dist/: ESM + .d.ts (tsc) and the IIFE (vite)
```

To try a change in a consumer before publishing: `npm link` here, then
`npm link @chordialguy/keyboard` there (undo with `npm unlink`). Never commit a
linked or `file:` dependency — ear-training's deploy runs `npm ci` on a lone
checkout.

## Releasing

```bash
npm version patch   # or minor / major — commits and tags
npm publish         # builds first (prepublishOnly); public via publishConfig
git push --follow-tags
```

Then in each consumer: `npm install @chordialguy/keyboard@latest`; in LWCG also
re-run the sync script and bump `CACHE_NAME` in `templates/pwa/sw.js`.

## `<cg-keyboard>`

```html
<cg-keyboard from="C3" to="B4" notation="indian" tonic="D3"
             degrees="0 1 4 5 7 8 11" outside="dim" instrument="harmonium"></cg-keyboard>
```

| Property / attribute | Default | |
| --- | --- | --- |
| `from`, `to` | `C4`, `B5` | MIDI number or name with octave. A black-key edge widens to the white key beside it. |
| `notation` | `western` | `western` (absolute names) or `indian` (sargam, Sa on `tonic`) |
| `tonic` | `C4` | Sa for sargam, and the root for `degrees`. `"G3"` fixes the madhya saptak; `"G"` means G4. |
| `labels` | `all` | `all`, `white`, `tonic` (only Sa/the root), `none` |
| `hide-octave` | off | Drop the octave number under Western names |
| `spelling` | `sharp` | `sharp` or `flat` |
| `notes` | none | Only these are playable: `"C D E G4 67"` (no octave = every octave) |
| `degrees` | none | Only these semitones above `tonic`: `"0 2 4 5 7 9 11"`. Both filters must pass. |
| `outside` | `disable` | Keys failing the filters: `disable` them or just `dim` them |
| `.active` | none | Pitches lit from outside. Assign a new array to change it. |
| `follow` | off | Scroll the lit key into view when `active` changes |
| `instrument` | `piano` | Any registered instrument |
| `velocity` | `0.75` | 0–1 |
| `silent` | off | Events only; the host plays sound |
| `disabled` | off | |
| `label` | `Keyboard` | Accessible name |

**Events** (bubble, composed), detail = `NoteInfo` (`pitch`, `pitchClass`,
`octave`, `name`, `black`, `swara {name, komal, tivra, saptak}`) + `included`:

- `cg-note-on` / `cg-note-off` — pointer or key down / up. Sound starts here.
- `cg-note-press` — a completed tap. **Act on this one**: a touch that turns
  into a pan sounds but never presses.

Keyboard access: one tab stop; arrows move between playable keys, Home/End
jump, Space/Enter play.

**Theming** is all `--cg-*` custom properties (heights, key widths, gap, every
key colour per state) — see the doc comment on `CgKeyboard`, and ear-training's
`et-piano.ts` for a full example. `::part(key)` is there for anything else.

## Sound

```ts
import { playNote, playClick, registerInstrument } from '@chordialguy/keyboard';
const voice = playNote(60, { instrument: 'guitar', at: ctx.currentTime + 1, duration: 0.5 });
voice.stop();
```

Built in: `piano`, `guitar`, `harmonium` (sustains while held). Add your own
with `registerInstrument(name, { label, tapDuration, sustains?, play(out, note) })`
— `play` connects to `out.dry` / `out.reverb` and returns a `Voice`
(`releaser()` builds one). One AudioContext is shared per page, even if the
library is loaded twice.

All pitches are **MIDI** (C4 = 60).
