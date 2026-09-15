import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import { useArgs } from '@storybook/preview-api';
import './cg-keyboard.js';
import { listInstruments } from '../audio/engine.js';

const log = (e: Event) => console.log(e.type, (e as CustomEvent).detail);

const meta: Meta = {
  title: 'Keyboard',
  component: 'cg-keyboard',
  tags: ['autodocs'],
  argTypes: {
    notation: { control: 'inline-radio', options: ['western', 'indian'] },
    labels: { control: 'inline-radio', options: ['all', 'white', 'tonic', 'none'] },
    outside: { control: 'inline-radio', options: ['disable', 'dim'] },
    spelling: { control: 'inline-radio', options: ['sharp', 'flat'] },
    instrument: { control: 'select', options: listInstruments().map(([name]) => name) },
  },
  args: {
    from: 'C4',
    to: 'B5',
    notation: 'western',
    tonic: 'C4',
    labels: 'all',
    hideOctave: false,
    spelling: 'sharp',
    notes: '',
    degrees: '',
    outside: 'disable',
    instrument: 'piano',
    silent: false,
    disabled: false,
  },
  render: (args) => html`
    <cg-keyboard
      from=${args.from}
      to=${args.to}
      notation=${args.notation}
      tonic=${args.tonic}
      labels=${args.labels}
      ?hide-octave=${args.hideOctave}
      spelling=${args.spelling}
      .notes=${args.notes || null}
      .degrees=${args.degrees || null}
      outside=${args.outside}
      instrument=${args.instrument}
      ?silent=${args.silent}
      ?disabled=${args.disabled}
      @cg-note-press=${log}
    ></cg-keyboard>
  `,
};
export default meta;

type Story = StoryObj;

export const Western: Story = {};

/** Sargam with Sa on G3. The saptak dots change at Sa, not at C. */
export const Sargam: Story = {
  args: { notation: 'indian', tonic: 'G3', from: 'C3', to: 'E5' },
};

/** Bhairav thaat on D. Keys outside it are disabled. */
export const ThaatDisabled: Story = {
  args: { notation: 'indian', tonic: 'D4', from: 'A3', to: 'E5', degrees: '0 1 4 5 7 8 11' },
};

/** The same, dimmed rather than disabled — how ear-training uses it. */
export const ThaatDimmed: Story = {
  args: { ...ThaatDisabled.args, outside: 'dim' },
};

/** Only named notes: the five a beginner's first tune needs. */
export const OnlyTheseNotes: Story = {
  args: { notes: 'C4 D4 E4 F4 G4', labels: 'white', from: 'C4', to: 'C5' },
};

/** Harmonium holds as long as the key does. */
export const Harmonium: Story = {
  args: { instrument: 'harmonium', notation: 'indian', tonic: 'C4' },
};

/** A phone-width frame: keys keep their minimum width and the track scrolls. */
export const Narrow: Story = {
  args: { from: 'C3', to: 'B5' },
  decorators: [(story) => html`<div style="width:360px">${story()}</div>`],
};

/** Themed through custom properties — here ear-training's navy frame and teal press. */
export const Themed: Story = {
  render: () => html`
    <cg-keyboard
      style="
        --cg-keyboard-background:#003049; --cg-keyboard-padding:2px; --cg-key-gap:1px;
        --cg-white-key-border:transparent; --cg-key-min-width:46px;
        --cg-key-pressed:#008080; --cg-white-key-pressed:#d6eaea; --cg-focus-ring:#008080;"
      from="F3"
      to="G5"
      tonic="C4"
      degrees="0 2 4 5 7 9 11"
      outside="dim"
    ></cg-keyboard>
  `,
};

/** Keys lit from outside, as a song player does in time with playback. */
export const Lit: Story = {
  args: { active: [64, 67, 72] },
  render: (args) => {
    const [, update] = useArgs();
    return html`
      <cg-keyboard from="C4" to="B5" labels="white" .active=${args.active}></cg-keyboard>
      <p>
        <button @click=${() => update({ active: [60, 64, 67] })}>C major</button>
        <button @click=${() => update({ active: [62, 65, 69] })}>D minor</button>
        <button @click=${() => update({ active: [] })}>None</button>
      </p>
    `;
  },
};
