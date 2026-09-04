// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '../../type';
import {
  CottiAiAccessModel,
  CottiAiAuthSchemaUnavailableError,
  normalizeCottiAiEmail,
  normalizeCottiAiPhone,
} from '../cottiAiAccess';

describe('CottiAiAccessModel identity normalization', () => {
  it('normalizes email addresses', () => {
    expect(normalizeCottiAiEmail(' User@Example.COM ')).toBe('user@example.com');
    expect(normalizeCottiAiEmail(' ')).toBeNull();
  });

  it.each([
    ['13800138000', '+8613800138000'],
    ['+86 138 0013 8000', '+8613800138000'],
    ['86-138-0013-8000', '+8613800138000'],
  ])('normalizes Chinese phone number %s', (input, expected) => {
    expect(normalizeCottiAiPhone(input)).toBe(expected);
  });

  it.each(['+1 202 555 0100', '1234', '23800138000'])(
    'rejects unsupported phone number %s',
    (input) => {
      expect(normalizeCottiAiPhone(input)).toBeNull();
    },
  );
});

describe('CottiAiAccessModel schema validation', () => {
  it('accepts the complete external identity schema', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        { tableName: 'access_members' },
        { tableName: 'oauthAccessToken' },
        { tableName: 'oauthRefreshToken' },
        { tableName: 'session' },
        { tableName: 'user' },
      ],
    });
    const model = new CottiAiAccessModel({ execute } as unknown as LobeChatDatabase);

    await expect(model.assertSchemaReady()).resolves.toBeUndefined();
  });

  it('reports missing external identity tables before member queries run', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ tableName: 'access_members' }] });
    const model = new CottiAiAccessModel({ execute } as unknown as LobeChatDatabase);

    await expect(model.assertSchemaReady()).rejects.toEqual(
      new CottiAiAuthSchemaUnavailableError([
        'oauthAccessToken',
        'oauthRefreshToken',
        'session',
        'user',
      ]),
    );
  });
});
