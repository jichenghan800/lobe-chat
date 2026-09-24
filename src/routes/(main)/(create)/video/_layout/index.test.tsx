import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import VideoLayout from './index';

describe('VideoLayout', () => {
  it('redirects direct video navigation to the image page', async () => {
    render(
      <MemoryRouter initialEntries={['/video']}>
        <Routes>
          <Route element={<VideoLayout />} path="/video" />
          <Route element={<div>Image generation</div>} path="/image" />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Image generation')).toBeInTheDocument();
  });
});
