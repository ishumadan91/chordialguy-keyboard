# CLAUDE.md — @chordialguy/keyboard

The keyboard (`cg-keyboard`), sargam glyph (`cg-swara`) and synth voices shared
by ear-training and the LWCG song player, published to npm as
`@chordialguy/keyboard`. README.md has the full API and the release steps.

## Rules that are easy to break

- **Everything is MIDI** (C4 = 60). ear-training's own numbering puts C4 at 48
  and converts at its seam; never add a second scheme here.
- **Two builds ship in `dist/`.** `tsc -p tsconfig.build.json` writes the ESM +
  `.d.ts` that bundlers import (Lit stays an external peer dependency);
  `vite build --mode lib` adds `chordialguy-keyboard.iife.js` with Lit bundled,
  for LWCG. `dist/` is never committed.
- **The IIFE stays IIFE** — LWCG serves static from a CDN with no CORS header,
  which blocks module scripts.
- **A release is not live until consumers take it.** ear-training and LWCG pin
  `^x.y.z`; after publishing, `npm install @chordialguy/keyboard@latest` in both
  (LWCG: in `apps/theme/static_src`, then `scripts/sync_learning_app.py
  chordialguy-keyboard` and a `CACHE_NAME` bump). Breaking changes to tags,
  events or `--cg-*` properties are a major version.
- **Register elements with `define()`, never `@customElement`** — a page that
  loads two copies must not throw on the second definition. Audio state lives on
  a `Symbol.for` global for the same reason.
- **Strict tsconfig** (`noUnusedLocals`, legacy decorators) matches
  ear-training's, which consumes the types.
- **Hover styles stay in `:where()`**, so held/lit/dimmed states win while the
  pointer is over a key.
- **`cg-note-press` is the tap**, `cg-note-on` is the sound. A touch that becomes
  a pan fires on/off but never press — hosts that record answers listen to press.
- Keep the guitar's **fractional delay line**; rounding it puts notes ~26 cents
  sharp. `resume()` must keep swallowing Safari's rejection.

## Commands

`npm run dev` (playground), `npm run storybook` (:6007), `npm run build`,
`npm pack --dry-run` (check what would publish).
