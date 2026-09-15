import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './cg-swara.js';

const meta: Meta = {
  title: 'Swara',
  component: 'cg-swara',
  tags: ['autodocs'],
  argTypes: {
    saptak: { control: 'inline-radio', options: ['mandra', 'madhya', 'taar'] },
  },
  args: { name: 'N', komal: false, tivra: false, saptak: 'madhya' },
  render: ({ name, komal, tivra, saptak }) => html`
    <cg-swara style="font-size:32px" name=${name} ?komal=${komal} ?tivra=${tivra} .saptak=${saptak}></cg-swara>
  `,
};
export default meta;

type Story = StoryObj;

export const Madhya: Story = {};

/** A line and a dot below the same letter — the case combining marks collide on. */
export const KomalMandra: Story = { args: { komal: true, saptak: 'mandra' } };

/** The tivra stroke sits right of centre, clear of the taar dot. */
export const TivraTaar: Story = { args: { name: 'M', tivra: true, saptak: 'taar' } };

export const Western: Story = {
  render: () => html`<cg-swara style="font-size:32px" name="F♯" .octaveLabel=${4}></cg-swara>`,
};
