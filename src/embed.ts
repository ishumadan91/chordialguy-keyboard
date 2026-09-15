/**
 * Classic-script entry. The build turns this into
 * `dist/chordialguy-keyboard.iife.js`, which registers the elements and assigns
 * the API to `window.ChordialGuyKeyboard`:
 *
 *   <script src="chordialguy-keyboard.iife.js"></script>
 *   <cg-keyboard from="C3" to="B4" notation="indian" tonic="D3"></cg-keyboard>
 *   <script>ChordialGuyKeyboard.playNote(60, { instrument: 'guitar' })</script>
 */
export * from './index.js';
