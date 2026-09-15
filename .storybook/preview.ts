import type { Preview } from '@storybook/web-components';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'sand',
      values: [
        { name: 'sand', value: '#f4f1de' },
        { name: 'surface', value: '#ffffff' },
      ],
    },
  },
};

export default preview;
