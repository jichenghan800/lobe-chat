import { describe, expect, it, vi } from 'vitest';

import { openAcceptedSandboxTopic } from './openAcceptedTopic';

describe('accepted sandbox topic navigation', () => {
  it('does not switch after the user navigates while refreshing', async () => {
    let current = true;
    const deps = {
      isSourceCurrent: () => current,
      isTargetCurrent: () => true,
      navigate: vi.fn(),
      refresh: async () => {
        current = false;
      },
      switchTopic: vi.fn(),
    };
    await openAcceptedSandboxTopic(deps);
    expect(deps.switchTopic).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });
  it('does not overwrite a navigation during the deliberate topic switch', async () => {
    const deps = {
      isSourceCurrent: () => true,
      isTargetCurrent: () => false,
      navigate: vi.fn(),
      refresh: vi.fn(),
      switchTopic: vi.fn(),
    };
    await openAcceptedSandboxTopic(deps);
    expect(deps.navigate).not.toHaveBeenCalled();
  });
  it('opens the new topic after accepting a turn in the current composer', async () => {
    const deps = {
      isSourceCurrent: () => true,
      isTargetCurrent: () => true,
      navigate: vi.fn(),
      refresh: vi.fn(),
      switchTopic: vi.fn(),
    };
    await openAcceptedSandboxTopic(deps);
    expect(deps.navigate).toHaveBeenCalledOnce();
  });
});
