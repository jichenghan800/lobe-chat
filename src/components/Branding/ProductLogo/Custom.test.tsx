import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import CustomLogo from './Custom';

vi.mock('@lobechat/business-const', () => ({ BRANDING_NAME: '灵枢AI', BRANDING_LOGO_URL: '' }));

it('renders an existing icon alongside the brand name when no custom logo is configured', () => {
  render(<CustomLogo type="combine" />);
  expect(screen.getByRole('img', { name: '灵枢AI' }).getAttribute('src')).toBe(
    '/app-icons/icon-192x192.png',
  );
  expect(screen.getByText('灵枢AI')).toBeTruthy();
});
