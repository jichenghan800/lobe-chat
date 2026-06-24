import { LobeHubIdentifier } from '@lobechat/builtin-skills';
import { describe, expect, it } from 'vitest';

import {
  guardTaskRunCommand,
  isTaskIsolatedRun,
  sanitizeLobehubSkillForTaskRun,
  sanitizeTaskCommandResult,
  shouldHideAgentDocuments,
  shouldHideKnowledgeBase,
  shouldHideTopicReference,
  shouldSkipAgentDocumentArchive,
} from '../taskIsolationPolicy';

describe('taskIsolationPolicy', () => {
  it('enables isolation for task scoped runs', () => {
    expect(isTaskIsolatedRun({ taskId: 'task-1' })).toBe(true);
    expect(shouldHideAgentDocuments({ taskId: 'task-1' })).toBe(true);
    expect(shouldHideKnowledgeBase({ taskId: 'task-1' })).toBe(true);
    expect(shouldHideTopicReference({ taskId: 'task-1' })).toBe(true);
    expect(shouldSkipAgentDocumentArchive({ taskId: 'task-1' })).toBe(true);
    expect(isTaskIsolatedRun({})).toBe(false);
  });

  it('guards task run commands without blocking web search', () => {
    expect(guardTaskRunCommand({ taskId: 'task-1' }, 'python3 script.py')).toMatchObject({
      allowed: false,
    });
    expect(guardTaskRunCommand({ taskId: 'task-1' }, 'lh doc list')).toMatchObject({
      allowed: false,
    });
    expect(guardTaskRunCommand({ taskId: 'task-1' }, 'lh search -q "AI PPT"')).toMatchObject({
      allowed: false,
    });
    expect(guardTaskRunCommand({ taskId: 'task-1' }, 'lh topic list')).toMatchObject({
      allowed: false,
    });
    expect(guardTaskRunCommand({ taskId: 'task-1' }, 'lh message list')).toMatchObject({
      allowed: false,
    });
    expect(guardTaskRunCommand({ taskId: 'task-1' }, 'lh search -q "AI PPT" --web')).toEqual({
      allowed: true,
    });
    expect(guardTaskRunCommand({}, 'lh doc list')).toEqual({ allowed: true });
  });

  it('sanitizes LobeHub skill resources and command examples for task runs', () => {
    const skill = sanitizeLobehubSkillForTaskRun({
      content:
        '| `lh doc` | Document management (create, parse, organize) |\n| `lh kb` | Knowledge base management (create, upload, organize) |\n| `lh topic` | Conversation topic management |\n| `lh message` | Message management |\n# Run an agent\nlh agent run -a <agentId> -p "Summarize today\'s tasks"\n',
      description: 'LobeHub',
      identifier: LobeHubIdentifier,
      name: 'LobeHub',
      resources: {
        'references/doc': { content: 'doc', fileHash: 'doc', size: 3 },
        'references/search': { content: 'search', fileHash: 'search', size: 6 },
      },
      source: 'builtin',
    });

    expect(skill.content).not.toContain('lh doc');
    expect(skill.content).not.toContain('lh kb');
    expect(skill.content).not.toContain('lh agent');
    expect(skill.content).not.toContain('lh topic');
    expect(skill.content).not.toContain('lh message');
    expect(skill.resources).not.toHaveProperty('references/doc');
    expect(skill.resources).toHaveProperty('references/search');
  });

  it('sanitizes command results for task runs', () => {
    const help = sanitizeTaskCommandResult({ taskId: 'task-1' }, 'lh --help', {
      exitCode: 0,
      output:
        'Commands:\n  doc  Manage documents\n  search Search across local resources or the web',
      stderr: '',
      success: true,
    });
    expect(help.output).not.toContain('Manage documents');
    expect(help.output).toContain('Search the web');

    const messages = sanitizeTaskCommandResult({ taskId: 'task-1' }, 'lh message list --json', {
      exitCode: 0,
      output: JSON.stringify([
        { content: 'user text', id: 'u1', role: 'user', tools: [{ id: 'hidden' }] },
        { content: 'tool secret', id: 't1', role: 'tool' },
      ]),
      stderr: '',
      success: true,
    });
    expect(messages.output).toContain('user text');
    expect(messages.output).not.toContain('tool secret');
    expect(messages.output).not.toContain('hidden');
  });
});
