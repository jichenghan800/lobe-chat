// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { VideoUnavailableRedirect } from './VideoUnavailableRedirect';

describe('video entry policy', () => {
  it.each(['/', '/workspace/'])(
    'redirects video in %s without carrying video parameters',
    async (prefix) => {
      const router = createMemoryRouter(
        [
          {
            path: prefix,
            children: [
              { path: 'video', element: <VideoUnavailableRedirect /> },
              { path: 'image', element: <div>Image workspace</div> },
            ],
          },
        ],
        { initialEntries: [prefix + 'video?model=video-model&topic=video-topic'] },
      );
      render(<RouterProvider router={router} />);
      await waitFor(() => expect(router.state.location.pathname).toBe(prefix + 'image'));
      expect(router.state.location.search).toBe('');
      expect(router.state.historyAction).toBe('REPLACE');
      expect(screen.getByText('Image workspace')).toBeInTheDocument();
    },
  );
});
