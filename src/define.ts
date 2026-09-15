/**
 * Register a custom element unless something already has.
 *
 * Not `@customElement`, which throws on a second definition. This library ships
 * twice by design — bundled inside ear-training, and as its own classic script
 * for the song player — and a page that ever loads both would otherwise lose
 * whichever bundle ran second, since an exception aborts the rest of an IIFE.
 * First definition wins; both copies are synced from the same source.
 */
export function define(tag: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
