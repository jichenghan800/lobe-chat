import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';
import * as betterAuthConfig from '@/libs/better-auth/utils/config';
import * as oidcAccessControl from '@/libs/oidc-provider/access-control';

import { CottiPlatformAdminAccessService } from './adminAccess';
import {
  CottiPeopleManagementService,
  isRegistrationAllowedByEnvironment,
} from './peopleManagement';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('COTTI people-management registration fallback', () => {
  it('keeps registration open when AUTH_ALLOWED_EMAILS is empty', () => {
    expect(isRegistrationAllowedByEnvironment('anyone@example.com', '')).toBe(true);
  });

  it('matches normalized exact emails and domains', () => {
    const rules = 'example.com, Invited@Other.com';

    expect(isRegistrationAllowedByEnvironment('USER@EXAMPLE.COM', rules)).toBe(true);
    expect(isRegistrationAllowedByEnvironment('invited@other.com', rules)).toBe(true);
    expect(isRegistrationAllowedByEnvironment('other@other.com', rules)).toBe(false);
  });

  it('imports the deployment allowlist before the first database mutation', async () => {
    vi.stubEnv('AUTH_ALLOWED_EMAILS', 'example.com, Invited@Other.com');
    const loginAccessModel = {
      getSettings: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      setMode: vi.fn().mockResolvedValue({ id: 'default', mode: 'open' }),
    };
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      loginAccessModel: loginAccessModel as never,
      platformAdminModel: {} as never,
    });

    await service.setLoginMode('open');

    expect(loginAccessModel.initialize).toHaveBeenCalledWith({
      mode: 'allowlist',
      rules: [
        { type: 'domain', value: 'example.com' },
        { type: 'email', value: 'invited@other.com' },
      ],
      updatedBy: 'admin-user',
    });
    expect(loginAccessModel.setMode).toHaveBeenCalledWith('open', 'admin-user');
  });

  it('deletes an imported deployment rule by its normalized type and value', async () => {
    vi.stubEnv('AUTH_ALLOWED_EMAILS', 'example.com, Invited@Other.com');
    const loginAccessModel = {
      getSettings: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      removeRule: vi.fn().mockResolvedValue(undefined),
      removeRuleByValue: vi.fn().mockResolvedValue(undefined),
    };
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      loginAccessModel: loginAccessModel as never,
      platformAdminModel: {} as never,
    });

    await service.removeLoginRule('environment:email:Invited@Other.com');

    expect(loginAccessModel.initialize).toHaveBeenCalledOnce();
    expect(loginAccessModel.removeRuleByValue).toHaveBeenCalledWith('email', 'invited@other.com');
    expect(loginAccessModel.removeRule).not.toHaveBeenCalled();
  });
});

describe('COTTI registered-user login control', () => {
  it('prevents the acting administrator from disabling their own login', async () => {
    const setLoginDisabled = vi.fn();
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      loginAccessModel: {} as never,
      platformAdminModel: {} as never,
      userLoginControlModel: { setLoginDisabled } as never,
    });

    await expect(service.setUserLoginDisabled('admin-user', true)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(setLoginDisabled).not.toHaveBeenCalled();
  });

  it('requires platform administrator access to be removed before disabling a user', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
      email: 'target@example.com',
      normalizedEmail: 'target@example.com',
      source: 'database_assignment',
      userId: 'target-user',
    });
    const setLoginDisabled = vi.fn();
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      loginAccessModel: {} as never,
      platformAdminModel: {} as never,
      userLoginControlModel: { setLoginDisabled } as never,
    });

    await expect(service.setUserLoginDisabled('target-user', true)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    expect(setLoginDisabled).not.toHaveBeenCalled();
  });

  it('disables a regular user and clears Redis and OIDC session material', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN' }),
    );
    const deleteSecondarySession = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(betterAuthConfig, 'createSecondaryStorage').mockReturnValue({
      delete: deleteSecondarySession,
      get: vi.fn(),
      set: vi.fn(),
    });
    const revokeOIDC = vi
      .spyOn(oidcAccessControl, 'revokeOIDCArtifactsByUserId')
      .mockResolvedValue(undefined);
    const setLoginDisabled = vi.fn().mockResolvedValue({
      sessionTokens: ['token-1', 'token-2'],
      user: { id: 'target-user' },
    });
    const db = {} as LobeChatDatabase;
    const service = new CottiPeopleManagementService(db, 'admin-user', {
      loginAccessModel: {} as never,
      platformAdminModel: {} as never,
      userLoginControlModel: { setLoginDisabled } as never,
    });

    await expect(
      service.setUserLoginDisabled('target-user', true, 'left the company'),
    ).resolves.toEqual({ id: 'target-user' });
    expect(setLoginDisabled).toHaveBeenCalledWith('target-user', true, 'left the company');
    expect(deleteSecondarySession).toHaveBeenCalledWith('token-1');
    expect(deleteSecondarySession).toHaveBeenCalledWith('token-2');
    expect(deleteSecondarySession).toHaveBeenCalledWith('active-sessions-target-user');
    expect(revokeOIDC).toHaveBeenCalledWith(db, 'target-user');
  });
});
