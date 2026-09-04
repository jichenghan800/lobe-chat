import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiAiIdentityConflictError } from '@/database/models/cottiAiAccess';
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

describe('COTTI AI access management environment isolation', () => {
  it('does not query the development identity schema when the flag is absent', async () => {
    vi.stubEnv('AUTH_ALLOWED_EMAILS', '');
    vi.stubEnv('COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS', '');
    vi.stubEnv('COTTI_AI_ACCESS_MANAGEMENT_ENABLED', '');
    const assertSchemaReady = vi.fn();
    const list = vi.fn();
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      cottiAiAccessModel: { assertSchemaReady, list } as never,
      loginAccessModel: {
        getSettings: vi.fn().mockResolvedValue(undefined),
        listRules: vi.fn().mockResolvedValue([]),
      } as never,
      platformAdminModel: { list: vi.fn().mockResolvedValue([]) } as never,
      userLoginControlModel: { listDisabled: vi.fn().mockResolvedValue([]) } as never,
    });

    await expect(service.getDetail()).resolves.toMatchObject({
      cottiAiAccessManagementEnabled: false,
      cottiAiAccessMembers: [],
    });
    expect(assertSchemaReady).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('validates the identity schema before loading development members', async () => {
    vi.stubEnv('AUTH_ALLOWED_EMAILS', '');
    vi.stubEnv('COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS', '');
    vi.stubEnv('COTTI_AI_ACCESS_MANAGEMENT_ENABLED', '1');
    const members = [{ id: 'cai_member_123' }];
    const assertSchemaReady = vi.fn().mockResolvedValue(undefined);
    const list = vi.fn().mockResolvedValue(members);
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      cottiAiAccessModel: { assertSchemaReady, list } as never,
      loginAccessModel: {
        getSettings: vi.fn().mockResolvedValue(undefined),
        listRules: vi.fn().mockResolvedValue([]),
      } as never,
      platformAdminModel: { list: vi.fn().mockResolvedValue([]) } as never,
      userLoginControlModel: { listDisabled: vi.fn().mockResolvedValue([]) } as never,
    });

    await expect(service.getDetail()).resolves.toMatchObject({
      cottiAiAccessManagementEnabled: true,
      cottiAiAccessMembers: members,
    });
    expect(assertSchemaReady).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledOnce();
    expect(assertSchemaReady.mock.invocationCallOrder[0]).toBeLessThan(
      list.mock.invocationCallOrder[0],
    );
  });

  it('rejects development-only mutations when the flag is absent', async () => {
    vi.stubEnv('COTTI_AI_ACCESS_MANAGEMENT_ENABLED', '');
    const upsert = vi.fn();
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      cottiAiAccessModel: { upsert } as never,
      loginAccessModel: {} as never,
      platformAdminModel: {} as never,
    });

    await expect(
      service.upsertCottiAiAccessMember({
        displayName: 'Development member',
        email: 'member@example.com',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('COTTI AI access member editing', () => {
  beforeEach(() => {
    vi.stubEnv('COTTI_AI_ACCESS_MANAGEMENT_ENABLED', '1');
  });

  it('updates both login identities on the same member', async () => {
    const updated = {
      authUserId: 'cai_user_123',
      displayName: 'Updated Member',
      email: 'updated@example.com',
      id: 'cai_member_123',
      phoneE164: '+8613900139000',
    };
    const update = vi.fn().mockResolvedValue(updated);
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      cottiAiAccessModel: { update } as never,
      loginAccessModel: {} as never,
      platformAdminModel: {} as never,
    });

    await expect(
      service.updateCottiAiAccessMember('cai_member_123', {
        displayName: 'Updated Member',
        email: 'updated@example.com',
        phone: '13900139000',
      }),
    ).resolves.toEqual(updated);
    expect(update).toHaveBeenCalledWith('cai_member_123', {
      displayName: 'Updated Member',
      email: 'updated@example.com',
      phone: '13900139000',
    });
  });

  it('reports an identity collision without merging accounts', async () => {
    const update = vi
      .fn()
      .mockRejectedValue(new CottiAiIdentityConflictError('Email is already in use'));
    const service = new CottiPeopleManagementService({} as LobeChatDatabase, 'admin-user', {
      cottiAiAccessModel: { update } as never,
      loginAccessModel: {} as never,
      platformAdminModel: {} as never,
    });

    await expect(
      service.updateCottiAiAccessMember('cai_member_123', {
        displayName: 'Member',
        email: 'duplicate@example.com',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'Email is already in use' });
  });
});
