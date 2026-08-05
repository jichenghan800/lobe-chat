import { describe, expect, it } from 'vitest';

import { reconcileComposioServers } from './action';
import { type ComposioServer, ComposioServerStatus } from './types';

const server = (
  identifier: string,
  status: ComposioServerStatus,
  agentId?: string,
): ComposioServer => ({
  agentId,
  appSlug: identifier,
  authConfigId: `auth-${identifier}`,
  connectedAccountId: `account-${identifier}`,
  createdAt: 0,
  identifier,
  label: identifier,
  status,
});

describe('reconcileComposioServers', () => {
  it('replaces a stale personal connection with the canonical active server', () => {
    const pending = server('gmail', ComposioServerStatus.PENDING_AUTH);
    const active = server('gmail', ComposioServerStatus.ACTIVE);

    expect(reconcileComposioServers([pending], [active])).toEqual([active]);
  });

  it('clears personal connections removed remotely', () => {
    expect(reconcileComposioServers([server('gmail', ComposioServerStatus.ACTIVE)], [])).toEqual(
      [],
    );
  });

  it('preserves agent-scoped connections that are absent from the personal endpoint', () => {
    const agentServer = server('gmail', ComposioServerStatus.ACTIVE, 'agent-1');
    const personalServer = server('slack', ComposioServerStatus.ACTIVE);

    expect(reconcileComposioServers([agentServer], [personalServer])).toEqual([
      personalServer,
      agentServer,
    ]);
  });
});
