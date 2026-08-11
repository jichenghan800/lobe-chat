import { describe, expect, it } from 'vitest';

import {
  isLoginAccessModeSelectable,
  shouldConfirmAgentAccessModeChange,
} from './peopleManagementSafety';

describe('peopleManagementSafety', () => {
  describe('shouldConfirmAgentAccessModeChange', () => {
    it('requires confirmation when expanding Agent access to everyone', () => {
      expect(shouldConfirmAgentAccessModeChange('allowlist', 'open')).toBe(true);
      expect(shouldConfirmAgentAccessModeChange('off', 'open')).toBe(true);
    });

    it('does not confirm unchanged or access-reducing changes', () => {
      expect(shouldConfirmAgentAccessModeChange('open', 'open')).toBe(false);
      expect(shouldConfirmAgentAccessModeChange('open', 'allowlist')).toBe(false);
      expect(shouldConfirmAgentAccessModeChange('allowlist', 'off')).toBe(false);
    });
  });

  describe('isLoginAccessModeSelectable', () => {
    it('keeps allowlist available and blocks high-risk open registration', () => {
      expect(isLoginAccessModeSelectable('allowlist')).toBe(true);
      expect(isLoginAccessModeSelectable('open')).toBe(false);
    });
  });
});
