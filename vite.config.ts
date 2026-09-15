import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    // The classic-script build, for hosts with no bundler (the LWCG song
    // player). IIFE rather than ESM because LWCG serves static from a CDN on
    // another origin with no CORS header, and a module fetch is always
    // CORS-mode. Lit is bundled in: a classic script cannot resolve a bare
    // import.
    //
    // Hosts that bundle use dist/index.js instead, where Lit is a peer
    // dependency and shared with the rest of the app.
    return {
      build: {
        lib: {
          entry: 'src/embed.ts',
          formats: ['iife' as const],
          name: 'ChordialGuyKeyboard',
          fileName: () => 'chordialguy-keyboard.iife.js',
        },
        outDir: 'dist',
        // `tsc` has already written the ESM build and types here.
        emptyOutDir: false,
      },
    };
  }

  // `npm run dev` — the playground in index.html.
  return {};
});
