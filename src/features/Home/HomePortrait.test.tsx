import { fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomePortrait from './HomePortrait';

const mocks = vi.hoisted(() => ({ fullBody: undefined as string | undefined }));
vi.mock('@lobehub/ui', () => ({ Tooltip: ({ children }: { children: ReactNode }) => children }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./AgentSelect/useResolvedHomeAgentId', () => ({
  useResolvedHomeAgentId: () => ({ agentId: 'agent' }),
}));
vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (s: { useFetchAgentConfig: () => void }) => unknown) =>
    selector({ useFetchAgentConfig: () => {} }),
}));
vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    getAgentMetaById: () => () => ({ avatar: 'default' }),
    getAgentFullBodyArtworkById: () => () => mocks.fullBody,
  },
}));
vi.mock('@/features/ChiefAgent/artwork', () => ({
  resolveChiefAgentArtwork: () => ({ id: 'lobe', hero: 'https://external.example/hero.webp' }),
}));

describe('Home portrait resilience', () => {
  beforeEach(() => {
    mocks.fullBody = undefined;
  });
  it('serves the default artwork from the application origin', () => {
    const { container } = render(<HomePortrait />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/avatars/lingshu-home-portrait.webp',
    );
  });
  it('preserves custom artwork and falls back to the bundled portrait on failure', () => {
    mocks.fullBody = 'https://external.example/custom.webp';
    const { container } = render(<HomePortrait />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(mocks.fullBody);
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('/avatars/lingshu-home-portrait.webp');
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('/avatars/lingshu-home-portrait.webp');
  });
});
