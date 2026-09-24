import { AgentBuilderIdentifier } from '@lobechat/builtin-tool-agent-builder';
import { describe, expect, it } from 'vitest';

import { getAgentRuntimeConfig } from '../../index';
import { BUILTIN_AGENT_SLUGS } from '../../types';

const resolvePlugins = (plugins?: string[]) =>
  getAgentRuntimeConfig(BUILTIN_AGENT_SLUGS.agentBuilder, { plugins })?.plugins ?? [];

describe('AGENT_BUILDER runtime plugins', () => {
  it('always includes the Agent Builder tool', () => {
    expect(resolvePlugins()).toEqual([AgentBuilderIdentifier]);
  });

  it('strips conflicting agent-editing / orchestration tools', () => {
    const plugins = resolvePlugins([
      'lobe-agent-management',
      'lobe-group-management',
      'lobe-group-agent-builder',
      'lobe-agent',
    ]);

    expect(plugins).toEqual([AgentBuilderIdentifier]);
  });

  it('keeps functional plugins (web browsing, Gmail/Composio, etc.)', () => {
    const plugins = resolvePlugins([
      'lobe-web-browsing',
      'lobe-image-generation',
      'gmail',
      'lobe-agent-management', // conflicting → removed
    ]);

    expect(plugins).toEqual([
      AgentBuilderIdentifier,
      'lobe-web-browsing',
      'lobe-image-generation',
      'gmail',
    ]);
  });
});

it('identifies the builtin builder as 灵枢AI while retaining its agent-configuration role', () => {
  const config = getAgentRuntimeConfig(BUILTIN_AGENT_SLUGS.agentBuilder, {});
  expect(config?.systemRole).toMatch(/^You are 灵枢AI, an Agent Builder integrated into 灵枢AI\./);
  expect(config?.systemRole).toContain('You configure agents; you never become one.');
});

it('identifies the default assistant as 灵枢AI and preserves the selected reply language', () => {
  const config = getAgentRuntimeConfig(BUILTIN_AGENT_SLUGS.inbox, { userLocale: 'zh-CN' });
  expect(config?.systemRole).toMatch(/^You are 灵枢AI,/);
  expect(config?.systemRole).toContain('Preferred reply language: zh-CN');
});
