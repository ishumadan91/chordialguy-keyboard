import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { define } from '../define.js';
import './cg-swara.js';
import '../audio/instruments.js';
import { getInstrument, playNote, type Voice } from '../audio/engine.js';
import {
  describeNote,
  spokenName,
  type Notation,
  type NoteInfo,
} from '../notation.js';
import {
  isBlackKey,
  noteSetHas,
  parseDegrees,
  parseNoteName,
  parseNoteSet,
  pitchClassOf,
  toMidi,
  type Midi,
  type NoteSetInput,
  type PitchInput,
  type Spelling,
} from '../pitch.js';

export type KeyLabels = 'all' | 'white' | 'tonic' | 'none';
export type OutsideKeys = 'disable' | 'dim';

export interface NoteEventDetail extends NoteInfo {
  /** False for a key outside `notes`/`degrees` that is only dimmed, not disabled. */
  included: boolean;
}

interface KeyModel {
  info: NoteInfo;
  /** Inside `notes` and `degrees` (true when neither is set). */
  included: boolean;
  playable: boolean;
  /** For a black key, how many white keys come before it. */
  whiteIndex: number;
}

/** A sustaining instrument held longer than this is let go anyway. */
const MAX_HOLD_SECONDS = 30;

/**
 * cg-keyboard — a playable piano keyboard.
 *
 * One component for every app that needs a keyboard: ear-training taps
 * answers on it, the song player lights it up in time with a melody. What
 * differs between them is configuration, not code.
 *
 * **Range.** `from` / `to` take a MIDI number or a name with an octave. A range
 * that starts or ends on a black key is widened to the white key beside it,
 * since half a black key hanging off the edge is not a key anyone can hit.
 *
 * **Labels.** `notation` picks Western names (absolute — C is always C) or
 * sargam (relative — Sa sits on `tonic`, and the saptak dots change at Sa).
 * `labels` says which keys carry one.
 *
 * **Which notes.** `notes` (`"C D E G4"`) and `degrees` (semitones above
 * `tonic`, `"0 2 4 5 7 9 11"`) each narrow the playable set; a key must satisfy
 * both when both are set. `outside` says what happens to the rest: `disable`
 * them, or only `dim` them — a hint rather than a rail, which is what an ear
 * test wants, since tapping a wrong note has to be possible.
 *
 * **Sound.** The keyboard plays its own notes on `instrument`, from pointer-down
 * so there is no click delay. Set `silent` to make it events-only.
 *
 * **Lighting keys.** Assign `active` (an array of pitches) to light keys from
 * outside, e.g. in time with playback. Assign a *new* array: the same array
 * mutated in place is not a change.
 *
 * A tap that turns into a horizontal pan on a touch screen sounds briefly but
 * never fires `cg-note-press` — that event is a completed tap, which is what a
 * host should act on.
 *
 * @fires cg-note-on    - CustomEvent<NoteEventDetail>, on pointer-down or key-down.
 * @fires cg-note-off   - CustomEvent<NoteEventDetail>, on release.
 * @fires cg-note-press - CustomEvent<NoteEventDetail>, on a completed tap or click.
 *
 * @csspart frame - the scrolling container
 * @csspart key - every key; also `white`/`black`, and `active`, `pressed`, `dimmed`, `disabled`
 *
 * @cssprop --cg-keyboard-height - Default 104px.
 * @cssprop --cg-key-min-width - White keys never get narrower; the keyboard scrolls instead. Default 34px.
 * @cssprop --cg-key-max-width - White keys never get wider; the keyboard centres instead. Default 9999px.
 * @cssprop --cg-key-gap - Space between white keys. Default 0px.
 * @cssprop --cg-key-radius - Default 5px.
 * @cssprop --cg-black-key-height - Fraction of the height. Default 62%.
 * @cssprop --cg-black-key-ratio - Black key width as a fraction of a white key. Default 0.62.
 * @cssprop --cg-keyboard-background / --cg-keyboard-padding / --cg-keyboard-radius / --cg-keyboard-shadow
 * @cssprop --cg-white-key / --cg-white-key-text / --cg-white-key-border / --cg-white-key-hover
 * @cssprop --cg-black-key / --cg-black-key-text / --cg-black-key-hover
 * @cssprop --cg-key-active / --cg-key-active-text - Keys lit through `active`. Default coral.
 * @cssprop --cg-white-key-active / --cg-white-key-active-text - Default: the active colour mixed 55% into white, with the normal label colour.
 * @cssprop --cg-key-pressed / --cg-white-key-pressed - Keys held down. Default: the active colours.
 * @cssprop --cg-white-key-dim / --cg-white-key-dim-text / --cg-white-key-dim-hover / --cg-black-key-dim / --cg-black-key-dim-hover
 * @cssprop --cg-key-label-size / --cg-black-key-label-size - Default 12px / 10px.
 * @cssprop --cg-focus-ring - Default teal.
 */
export class CgKeyboard extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_gap: var(--cg-key-gap, 0px);
      --_active: var(--cg-key-active, #ff6f61);
      --_white-active: var(--cg-white-key-active, color-mix(in srgb, var(--_active) 55%, #fff));
      font-family: var(--cg-font-family, inherit);
    }
    .frame {
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      background: var(--cg-keyboard-background, transparent);
      padding: var(--cg-keyboard-padding, 0);
      border-radius: var(--cg-keyboard-radius, 6px);
      box-shadow: var(--cg-keyboard-shadow, none);
    }
    .track {
      /* The width of one white key. Its 100% is resolved where it is used — on
         a black key, whose containing block is this track — so it means the
         track's width there. */
      --_w: calc((100% - (var(--_n) - 1) * var(--_gap)) / var(--_n));
      position: relative;
      display: flex;
      gap: var(--_gap);
      height: var(--cg-keyboard-height, 104px);
      min-width: calc(var(--cg-key-min-width, 34px) * var(--_n) + (var(--_n) - 1) * var(--_gap));
      max-width: calc(var(--cg-key-max-width, 9999px) * var(--_n) + (var(--_n) - 1) * var(--_gap));
      margin-inline: auto;
      /* Scrolling still works from the keys; double-tap zoom does not steal a
         quickly repeated note. */
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    button {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      font-weight: 700;
      line-height: 1.1;
      -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible {
      outline: 2px solid var(--cg-focus-ring, #008080);
      outline-offset: -3px;
    }

    .white {
      flex: 1 1 0;
      min-width: 0;
      padding-bottom: 6px;
      background: var(--cg-white-key, #fff);
      color: var(--cg-white-key-text, #003049);
      border: 1px solid var(--cg-white-key-border, rgb(0 48 73 / 0.25));
      border-top: 0;
      border-radius: 0 0 var(--cg-key-radius, 5px) var(--cg-key-radius, 5px);
      font-size: var(--cg-key-label-size, 12px);
    }
    /* Adjacent borders would double up where keys touch. */
    .white + .white,
    .black + .white {
      border-left-width: var(--cg-white-key-seam, 0px);
    }
    .black {
      position: absolute;
      top: 0;
      z-index: 2;
      left: calc(
        var(--_i) * var(--_w) + (var(--_i) - 0.5) * var(--_gap) -
          var(--_w) * var(--cg-black-key-ratio, 0.62) / 2
      );
      width: calc(var(--_w) * var(--cg-black-key-ratio, 0.62));
      height: var(--cg-black-key-height, 62%);
      padding-bottom: 5px;
      background: var(--cg-black-key, #0b2a36);
      color: var(--cg-black-key-text, #fff);
      border-radius: 0 0 calc(var(--cg-key-radius, 5px) - 1px) calc(var(--cg-key-radius, 5px) - 1px);
      font-size: var(--cg-black-key-label-size, 10px);
    }

    /* Hover is wrapped in :where() so it adds no specificity — every state
       below it (dimmed, lit, held) must still win while the pointer is over
       the key, which is exactly when a key is being pressed. */
    @media (hover: hover) {
      .white:where(:not(:disabled):hover) {
        background: var(--cg-white-key-hover, #f1f4f5);
      }
      .black:where(:not(:disabled):hover) {
        background: var(--cg-black-key-hover, #1d4656);
      }
    }

    .white.dimmed {
      background: var(--cg-white-key-dim, #e5e7eb);
      color: var(--cg-white-key-dim-text, #6b7280);
    }
    .black.dimmed {
      background: var(--cg-black-key-dim, #6b7280);
    }
    @media (hover: hover) {
      .white.dimmed:where(:hover) {
        background: var(--cg-white-key-dim-hover, #d8dbe0);
      }
      .black.dimmed:where(:hover) {
        background: var(--cg-black-key-dim-hover, #4b5563);
      }
    }

    /* Lit from outside, then held down: pressed wins, since it is the more
       immediate of the two. A lit white key is a tint, not the full colour, so
       its label stays dark. */
    .white.active {
      background: var(--_white-active);
      border-color: var(--_active);
      color: var(--cg-white-key-active-text, var(--cg-white-key-text, #003049));
    }
    .black.active {
      background: var(--_active);
      color: var(--cg-key-active-text, #fff);
    }
    .white.pressed {
      background: var(--cg-white-key-pressed, var(--_white-active));
    }
    .black.pressed {
      background: var(--cg-key-pressed, var(--_active));
    }

    button:disabled {
      cursor: not-allowed;
    }
    /* A key outside \`notes\`/\`degrees\` looks out of play. A whole disabled
       keyboard only fades, so the scale shape stays readable. */
    .white.disabled {
      background: var(--cg-white-key-dim, #e5e7eb);
      color: var(--cg-white-key-dim-text, #6b7280);
    }
    .black.disabled {
      background: var(--cg-black-key-dim, #6b7280);
    }
    :host([disabled]) .track {
      opacity: 0.55;
    }
  `;

  /** Lowest key: a MIDI number or a name with an octave. */
  @property() from: PitchInput = 'C4';
  /** Highest key. */
  @property() to: PitchInput = 'B5';
  @property({ reflect: true }) notation: Notation = 'western';
  /**
   * The tonic — Sa, in Indian notation. With an octave (`"G3"`) it also fixes
   * where the madhya saptak starts; a bare name (`"G"`) puts it in octave 4.
   */
  @property() tonic: PitchInput = 'C4';
  @property() labels: KeyLabels = 'all';
  /** Drop the octave number from Western labels. */
  @property({ type: Boolean, attribute: 'hide-octave' }) hideOctave = false;
  @property() spelling: Spelling = 'sharp';

  /** Only these notes are playable: `"C D E"`, `["C4", 62]`. */
  @property() notes: NoteSetInput = null;
  /** Only these semitones above `tonic` are playable: `"0 2 4 5 7 9 11"`. */
  @property() degrees: string | ReadonlyArray<number> | null = null;
  /** What becomes of keys outside `notes`/`degrees`. */
  @property() outside: OutsideKeys = 'disable';

  /** Keys lit from outside. Assign a new array to change it. */
  @property() active: NoteSetInput = null;
  /** Scroll the first lit key into view when `active` changes. */
  @property({ type: Boolean }) follow = false;

  /** Registered instrument name: `piano`, `guitar`, `harmonium`, or your own. */
  @property() instrument = 'piano';
  /** 0–1. */
  @property({ type: Number }) velocity = 0.75;
  /** Emit events but make no sound — for hosts that play notes themselves. */
  @property({ type: Boolean }) silent = false;

  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Accessible name for the whole keyboard. */
  @property() label = 'Keyboard';

  @state() private _pressed: ReadonlySet<Midi> = new Set();
  @state() private _focusPitch: Midi | null = null;

  private _keys: KeyModel[] = [];
  private _whiteCount = 0;
  private _active: ReadonlySet<Midi> = new Set();
  private _voices = new Map<Midi, Voice>();
  private _pointers = new Map<number, Midi>();
  /** The pitch a pointer or key-down already sounded, so the click that follows doesn't sound it twice. */
  private _sounded: Midi | null = null;

  /* ------------------------------------------------------------ model --- */

  private get _tonicMidi(): Midi {
    const absolute = toMidi(this.tonic);
    if (absolute !== null) return absolute;
    const parsed = typeof this.tonic === 'string' ? parseNoteName(this.tonic) : null;
    return 60 + (parsed?.pitchClass ?? 0);
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('disabled') && this.disabled) this._releaseAll();
    if (changed.has('active')) {
      const set = parseNoteSet(this.active);
      this._active = new Set(set ? set.pitches : []);
    }

    const layoutProps = ['from', 'to', 'notation', 'tonic', 'spelling', 'notes', 'degrees', 'outside'] as const;
    if (!layoutProps.some((p) => changed.has(p)) && this._keys.length) return;

    let low = toMidi(this.from) ?? 60;
    let high = toMidi(this.to) ?? 83;
    if (low > high) [low, high] = [high, low];
    low = Math.max(0, low - (isBlackKey(low) ? 1 : 0));
    high = Math.min(127, high + (isBlackKey(high) ? 1 : 0));

    const tonic = this._tonicMidi;
    const noteSet = parseNoteSet(this.notes);
    const degrees = parseDegrees(this.degrees);

    const keys: KeyModel[] = [];
    let whites = 0;
    for (let midi = low; midi <= high; midi++) {
      const info = describeNote(midi, tonic, this.spelling);
      const included =
        (!noteSet || noteSetHas(noteSet, midi)) &&
        (!degrees || degrees.has(pitchClassOf(midi - tonic)));
      keys.push({
        info,
        included,
        playable: included || this.outside === 'dim',
        whiteIndex: whites,
      });
      if (!info.black) whites++;
    }
    this._keys = keys;
    this._whiteCount = whites;

    if (this._focusPitch === null || !this._isPlayable(this._focusPitch)) {
      const home = keys.find((k) => k.playable && k.info.pitchClass === pitchClassOf(tonic));
      this._focusPitch = (home ?? keys.find((k) => k.playable))?.info.pitch ?? null;
    }
  }

  protected updated(changed: PropertyValues<this>) {
    if (this.follow && changed.has('active') && this._active.size) {
      const first = Math.min(...this._active);
      this.scrollToPitch(first, { onlyIfHidden: true });
    }
  }

  private _key(midi: Midi): KeyModel | undefined {
    const first = this._keys[0];
    return first ? this._keys[midi - first.info.pitch] : undefined;
  }

  private _isPlayable(midi: Midi): boolean {
    return !!this._key(midi)?.playable;
  }

  private _detail(key: KeyModel): NoteEventDetail {
    return { ...key.info, swara: { ...key.info.swara }, included: key.included };
  }

  private _emit(name: string, key: KeyModel) {
    this.dispatchEvent(
      new CustomEvent<NoteEventDetail>(name, {
        detail: this._detail(key),
        bubbles: true,
        composed: true,
      }),
    );
  }

  /* ------------------------------------------------------------- sound --- */

  private _noteOn(key: KeyModel) {
    const pitch = key.info.pitch;
    if (this._pressed.has(pitch)) return;
    this._pressed = new Set([...this._pressed, pitch]);
    this._sounded = pitch;

    if (!this.silent) {
      const def = getInstrument(this.instrument);
      this._voices.get(pitch)?.stop();
      this._voices.set(
        pitch,
        playNote(pitch, {
          instrument: this.instrument,
          velocity: this.velocity,
          duration: def?.sustains ? MAX_HOLD_SECONDS : undefined,
        }),
      );
    }
    this._emit('cg-note-on', key);
  }

  private _noteOff(key: KeyModel) {
    const pitch = key.info.pitch;
    if (!this._pressed.has(pitch)) return;
    const next = new Set(this._pressed);
    next.delete(pitch);
    this._pressed = next;

    // A struck or plucked string rings on by itself; only a sustaining
    // instrument is held by the key.
    if (getInstrument(this.instrument)?.sustains) this._voices.get(pitch)?.stop();
    this._voices.delete(pitch);
    this._emit('cg-note-off', key);
  }

  /** Release everything held — used when the keyboard is disabled or removed mid-press. */
  private _releaseAll() {
    for (const pitch of this._pressed) {
      const key = this._key(pitch);
      if (key) this._noteOff(key);
    }
    for (const voice of this._voices.values()) voice.stop();
    this._voices.clear();
    this._pointers.clear();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._releaseAll();
  }

  /* ------------------------------------------------------------ input --- */

  private _onPointerDown(e: PointerEvent, key: KeyModel) {
    if (this.disabled || !key.playable) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Left un-cancelled, so a touch that turns into a pan still scrolls.
    this._pointers.set(e.pointerId, key.info.pitch);
    this._noteOn(key);
  }

  private _onPointerEnd(e: PointerEvent) {
    const pitch = this._pointers.get(e.pointerId);
    if (pitch === undefined) return;
    this._pointers.delete(e.pointerId);
    const key = this._key(pitch);
    if (key) this._noteOff(key);
    // A pan cancels the pointer and no click follows; forget the sounding so
    // the next keyboard activation of this key is not treated as its click.
    if (e.type === 'pointercancel') this._sounded = null;
  }

  private _onKeyDown(e: KeyboardEvent, key: KeyModel) {
    const move: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (e.key in move) {
      e.preventDefault();
      this._moveFocus(key.info.pitch, move[e.key]);
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const playable = this._keys.filter((k) => k.playable);
      const target = e.key === 'Home' ? playable[0] : playable[playable.length - 1];
      if (target) this._focusKey(target.info.pitch);
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !this.disabled && key.playable) {
      this._noteOn(key);
    }
  }

  private _onKeyUp(e: KeyboardEvent, key: KeyModel) {
    if (e.key === ' ' || e.key === 'Enter') this._noteOff(key);
  }

  private _onClick(key: KeyModel) {
    if (this.disabled || !key.playable) return;
    this._focusPitch = key.info.pitch;
    // Nothing sounded it on the way down — a programmatic click, or assistive
    // tech that activates without key events. Give it a tap.
    if (this._sounded !== key.info.pitch) {
      this._noteOn(key);
      this._noteOff(key);
    }
    this._sounded = null;
    this._emit('cg-note-press', key);
  }

  private _moveFocus(from: Midi, step: number) {
    for (let midi = from + step; this._key(midi); midi += step) {
      if (this._isPlayable(midi)) {
        this._focusKey(midi);
        return;
      }
    }
  }

  private async _focusKey(midi: Midi) {
    this._focusPitch = midi;
    await this.updateComplete;
    this._button(midi)?.focus();
  }

  private _button(midi: Midi): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>(`button[data-pitch="${midi}"]`);
  }

  /* ----------------------------------------------------------- public --- */

  /**
   * Scroll a key into the middle of the visible range. With `onlyIfHidden`,
   * leave the scroll alone when the key is already fully in view.
   */
  async scrollToPitch(
    pitch: PitchInput,
    { behavior = 'smooth', onlyIfHidden = false }: { behavior?: ScrollBehavior; onlyIfHidden?: boolean } = {},
  ) {
    await this.updateComplete;
    const midi = toMidi(pitch);
    const frame = this.renderRoot.querySelector<HTMLElement>('.frame');
    const button = midi === null ? null : this._button(midi);
    if (!frame || !button) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (onlyIfHidden && left >= frame.scrollLeft && right <= frame.scrollLeft + frame.clientWidth) return;
    frame.scrollTo({ left: left + button.offsetWidth / 2 - frame.clientWidth / 2, behavior });
  }

  /* ----------------------------------------------------------- render --- */

  private _showLabel(key: KeyModel): boolean {
    switch (this.labels) {
      case 'none':
        return false;
      case 'white':
        return !key.info.black;
      case 'tonic':
        return key.info.pitchClass === pitchClassOf(this._tonicMidi);
      default:
        return true;
    }
  }

  private _renderLabel(key: KeyModel) {
    if (!this._showLabel(key)) return nothing;
    const { info } = key;
    if (this.notation === 'indian') {
      return html`<cg-swara
        name=${info.swara.name}
        ?komal=${info.swara.komal}
        ?tivra=${info.swara.tivra}
        .saptak=${info.swara.saptak}
      ></cg-swara>`;
    }
    return html`<cg-swara name=${info.name} .octaveLabel=${this.hideOctave ? null : info.octave}></cg-swara>`;
  }

  render() {
    return html`
      <div class="frame" part="frame">
        <div class="track" role="group" aria-label=${this.label} style="--_n:${Math.max(1, this._whiteCount)}">
          ${this._keys.map((key) => {
            const { info } = key;
            const colour = info.black ? 'black' : 'white';
            const states = [
              this._active.has(info.pitch) ? 'active' : '',
              this._pressed.has(info.pitch) ? 'pressed' : '',
              key.included ? '' : this.outside === 'dim' ? 'dimmed' : 'disabled',
            ].filter(Boolean);
            const classes = [colour, ...states].join(' ');
            return html`<button
              class=${classes}
              part=${`key ${classes}`}
              style=${info.black ? `--_i:${key.whiteIndex}` : nothing}
              data-pitch=${info.pitch}
              tabindex=${info.pitch === this._focusPitch ? 0 : -1}
              ?disabled=${this.disabled || !key.playable}
              aria-label=${spokenName(info, this.notation)}
              @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, key)}
              @pointerup=${this._onPointerEnd}
              @pointercancel=${this._onPointerEnd}
              @pointerleave=${this._onPointerEnd}
              @keydown=${(e: KeyboardEvent) => this._onKeyDown(e, key)}
              @keyup=${(e: KeyboardEvent) => this._onKeyUp(e, key)}
              @click=${() => this._onClick(key)}
            >${this._renderLabel(key)}</button>`;
          })}
        </div>
      </div>
    `;
  }
}

define('cg-keyboard', CgKeyboard);

declare global {
  interface HTMLElementTagNameMap {
    'cg-keyboard': CgKeyboard;
  }
}
