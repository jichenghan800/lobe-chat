// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';
import { CottiPeopleManagementService } from '@/server/services/cotti/peopleManagement';

import { cottiRouter } from './index';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

const adminIdentity = {
  email: 'admin@example.com',
  normalizedEmail: 'admin@example.com',
  source: 'email_allowlist' as const,
  userId: 'admin-user',
};

beforeEach(() => {
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue(
    adminIdentity,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cotti.peopleManagement router', () => {
  it('rejects a caller without platform administrator access', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'denied' }),
    );
    const getDetail = vi.spyOn(CottiPeopleManagementService.prototype, 'getDetail');
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.peopleManagement.detail()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getDetail).not.toHaveBeenCalled();
  });

  it('returns the combined people-management configuration', async () => {
    const detail = {
      administrators: [],
      cottiAiAccessManagementEnabled: false,
      cottiAiAccessMembers: [],
      disabledLoginUsers: [],
      loginAccess: { mode: 'allowlist' as const, rules: [], source: 'environment' as const },
    };
    vi.spyOn(CottiPeopleManagementService.prototype, 'getDetail').mockResolvedValue(detail);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.peopleManagement.detail()).resolves.toEqual({
      data: detail,
      success: true,
    });
  });

  it('validates and saves a registration access rule', async () => {
    const rule = {
      accessedAt: new Date(),
      createdAt: new Date(),
      createdBy: 'admin-user',
      enabled: true,
      id: '00000000-0000-4000-8000-000000000001',
      note: 'first batch',
      type: 'email' as const,
      updatedAt: new Date(),
      value: 'person@example.com',
    };
    const upsertLoginRule = vi
      .spyOn(CottiPeopleManagementService.prototype, 'upsertLoginRule')
      .mockResolvedValue(rule);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.upsertLoginRule({
        note: 'first batch',
        type: 'email',
        value: 'person@example.com',
      }),
    ).resolves.toEqual({ data: rule, message: 'Login access rule saved', success: true });
    expect(upsertLoginRule).toHaveBeenCalledWith({
      note: 'first batch',
      type: 'email',
      value: 'person@example.com',
    });
  });

  it('rejects an invalid registration domain before the service is called', async () => {
    const upsertLoginRule = vi.spyOn(CottiPeopleManagementService.prototype, 'upsertLoginRule');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.upsertLoginRule({ type: 'domain', value: 'not-a-domain' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(upsertLoginRule).not.toHaveBeenCalled();
  });

  it('validates and saves a COTTI AI phone and email member', async () => {
    const member = {
      authUserId: 'cai_user_123',
      createdAt: new Date(),
      createdBy: 'admin-user',
      displayName: 'Test Member',
      email: 'member@example.com',
      enabled: true,
      id: 'cai_member_123',
      note: null,
      phoneE164: '+8613800138000',
      updatedAt: new Date(),
    };
    const upsert = vi
      .spyOn(CottiPeopleManagementService.prototype, 'upsertCottiAiAccessMember')
      .mockResolvedValue(member);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.upsertCottiAiAccessMember({
        displayName: 'Test Member',
        email: 'member@example.com',
        phone: '13800138000',
      }),
    ).resolves.toEqual({ data: member, message: 'COTTI AI access member saved', success: true });
    expect(upsert).toHaveBeenCalledWith({
      displayName: 'Test Member',
      email: 'member@example.com',
      phone: '13800138000',
    });
  });

  it('rejects a COTTI AI member without a valid identity', async () => {
    const upsert = vi.spyOn(CottiPeopleManagementService.prototype, 'upsertCottiAiAccessMember');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.upsertCottiAiAccessMember({ displayName: 'Test Member' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('validates and updates a COTTI AI member with phone and email login', async () => {
    const member = {
      authUserId: 'cai_user_123',
      createdAt: new Date(),
      createdBy: 'admin-user',
      displayName: 'Updated Member',
      email: 'updated@example.com',
      enabled: true,
      id: 'cai_member_123',
      note: 'primary account',
      phoneE164: '+8613900139000',
      updatedAt: new Date(),
    };
    const update = vi
      .spyOn(CottiPeopleManagementService.prototype, 'updateCottiAiAccessMember')
      .mockResolvedValue(member);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.updateCottiAiAccessMember({
        displayName: 'Updated Member',
        email: 'updated@example.com',
        id: 'cai_member_123',
        note: 'primary account',
        phone: '13900139000',
      }),
    ).resolves.toEqual({
      data: member,
      message: 'COTTI AI access member updated',
      success: true,
    });
    expect(update).toHaveBeenCalledWith('cai_member_123', {
      displayName: 'Updated Member',
      email: 'updated@example.com',
      note: 'primary account',
      phone: '13900139000',
    });
  });

  it('accepts a validated environment registration rule id for deletion', async () => {
    const removeLoginRule = vi
      .spyOn(CottiPeopleManagementService.prototype, 'removeLoginRule')
      .mockResolvedValue(undefined);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.removeLoginRule({ id: 'environment:email:person@example.com' }),
    ).resolves.toEqual({ message: 'Login access rule removed', success: true });
    expect(removeLoginRule).toHaveBeenCalledWith('environment:email:person@example.com');
  });

  it('rejects a malformed environment registration rule id before deletion', async () => {
    const removeLoginRule = vi.spyOn(CottiPeopleManagementService.prototype, 'removeLoginRule');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.removeLoginRule({ id: 'environment:email:not-an-email' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(removeLoginRule).not.toHaveBeenCalled();
  });

  it('adds an existing user as a platform administrator', async () => {
    const assignment = {
      accessedAt: new Date(),
      createdAt: new Date(),
      createdBy: 'admin-user',
      id: '00000000-0000-4000-8000-000000000002',
      note: null,
      updatedAt: new Date(),
      userId: 'target-user',
    };
    const addAdministrator = vi
      .spyOn(CottiPeopleManagementService.prototype, 'addAdministrator')
      .mockResolvedValue(assignment);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.addAdministrator({ userId: 'target-user' }),
    ).resolves.toEqual({
      data: assignment,
      message: 'Platform administrator added',
      success: true,
    });
    expect(addAdministrator).toHaveBeenCalledWith('target-user', undefined);
  });

  it('disables an existing user login through platform administrator access', async () => {
    const user = {
      banReason: 'left the company',
      email: 'person@example.com',
      fullName: 'Person',
      id: 'target-user',
      normalizedEmail: 'person@example.com',
      updatedAt: new Date(),
      username: null,
    };
    const setUserLoginDisabled = vi
      .spyOn(CottiPeopleManagementService.prototype, 'setUserLoginDisabled')
      .mockResolvedValue(user);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.peopleManagement.setUserLoginDisabled({
        disabled: true,
        reason: 'left the company',
        userId: 'target-user',
      }),
    ).resolves.toEqual({ data: user, message: 'User login disabled', success: true });
    expect(setUserLoginDisabled).toHaveBeenCalledWith('target-user', true, 'left the company');
  });
});
