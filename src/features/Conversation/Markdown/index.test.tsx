import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MarkdownMessage from './index';

vi.mock('@/store/user', () => ({
  useUserStore: () => ({ fontSize: 14, highlighterTheme: 'github-light', mermaidTheme: 'default' }),
}));
vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: { config: vi.fn() },
}));

const source = 'https://example.com/original.png';

describe('conversation image previews', () => {
  it('caps inline image dimensions without changing the original source', async () => {
    render(
      <MarkdownMessage enableStream={false}>{`![Generated image 1](${source})`}</MarkdownMessage>,
    );
    const image = await screen.findByRole('img', { name: 'Generated image 1' });
    expect(image).toHaveAttribute('src', source);
    expect(image).toHaveStyle({
      maxHeight: '320px',
      maxWidth: 'min(100%, 320px)',
      objectFit: 'contain',
    });
  });

  it('retains caller image options and surrounding message text', async () => {
    render(
      <MarkdownMessage
        componentProps={{ img: { loading: 'eager', preview: false } }}
        enableStream={false}
      >
        {`Image ready.\n\n![Generated image 1](${source})`}
      </MarkdownMessage>,
    );
    const image = await screen.findByRole('img', { name: 'Generated image 1' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveStyle({ maxHeight: '320px' });
    expect(screen.getByText('Image ready.')).toBeInTheDocument();
  });
});
