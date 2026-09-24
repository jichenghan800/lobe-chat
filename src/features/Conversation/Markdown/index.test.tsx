import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('opens a tall image fitted inside the viewport while preserving its original source', async () => {
    render(<MarkdownMessage enableStream={false}>{`![Tall poster](${source})`}</MarkdownMessage>);
    const image = await screen.findByRole('img', { name: 'Tall poster' });
    Object.defineProperties(image, {
      naturalHeight: { configurable: true, value: 1376 },
      naturalWidth: { configurable: true, value: 768 },
    });
    fireEvent.click(image);
    const dialog = await screen.findByRole('dialog');
    const preview = within(dialog).getByRole('img', { name: 'Tall poster' });
    await waitFor(() => expect(preview.style.transform).toContain('scale(1)'));
    expect(parseFloat(preview.style.height)).toBeLessThanOrEqual(window.innerHeight);
    expect(preview).toHaveAttribute('src', source);
    fireEvent.keyDown(dialog, { key: 'Escape' });
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
