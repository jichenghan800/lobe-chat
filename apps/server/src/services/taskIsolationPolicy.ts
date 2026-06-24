import { LobeHubIdentifier } from '@lobechat/builtin-skills';
import type { CommandResult } from '@lobechat/builtin-tool-skills';
import type { BuiltinSkill } from '@lobechat/types';

export interface TaskIsolationContext {
  isolated?: boolean;
  taskId?: unknown;
}

export interface CommandGuardResult {
  allowed: boolean;
  stderr?: string;
}

export const isTaskIsolatedRun = (context: TaskIsolationContext) =>
  context.isolated === true || (typeof context.taskId === 'string' && context.taskId.length > 0);

export const shouldHideAgentDocuments = isTaskIsolatedRun;

export const shouldHideKnowledgeBase = isTaskIsolatedRun;

export const shouldHideTopicReference = isTaskIsolatedRun;

export const shouldSkipAgentDocumentArchive = isTaskIsolatedRun;

export const sanitizeLobehubSkillForTaskRun = (skill: BuiltinSkill): BuiltinSkill => {
  if (skill.identifier !== LobeHubIdentifier) return skill;

  const resources = { ...skill.resources };
  delete resources['references/agent'];
  delete resources['references/doc'];
  delete resources['references/file'];
  delete resources['references/kb'];

  return {
    ...skill,
    content: skill.content
      .replace('| `lh kb` | Knowledge base management (create, upload, organize) |\n', '')
      .replace('| `lh file` | File management |\n', '')
      .replace('| `lh doc` | Document management (create, parse, organize) |\n', '')
      .replace('| `lh agent` | Agent management (create, configure, run) |\n', '')
      .replace('# List knowledge bases\nlh kb list\n\n', '')
      .replace(
        '# Create a document in a knowledge base\nlh kb create-doc <kbId> -t "Meeting Notes" -c "..."\n\n',
        '',
      )
      .replace('# Run an agent\nlh agent run -a <agentId> -p "Summarize today\'s tasks"\n', '')
      .replaceAll('lh agent', 'agent CLI disabled'),
    description:
      'Manage allowed LobeHub platform capabilities via the `lh` CLI for this task run. Agent, file, document, and knowledge-base management are disabled in task-isolated runs.',
    resources,
  };
};

const isBlockedTaskResourceCommand = (command: string) =>
  /(?:^|&&|\|\||;)\s*lh\s+(?:agent|doc|file|kb)(?:\s|$)/.test(command);

const isLhCommand = (command: string) => /^\s*lh\s+/.test(command);

const isTaskSearchCommand = (command: string) =>
  /(?:^|&&|\|\||;)\s*lh\s+search(?:\s|$)/.test(command);

const isAllowedTaskSearchCommand = (command: string) => {
  if (/(?:^|\s)(?:--help|-h)(?:\s|$)/.test(command)) return true;
  if (/(?:^|\s)(?:--web|-w)(?:\s|$)/.test(command)) return true;

  return /(?:^|&&|\|\||;)\s*lh\s+search\s+view\s+https?:\/\//.test(command);
};

const isTaskMessageListCommand = (command: string) =>
  /(?:^|&&|\|\||;)\s*lh\s+message\s+list(?:\s|$)/.test(command);

const isTaskLhHelpCommand = (command: string) =>
  /(?:^|&&|\|\||;)\s*lh(?:\s+search)?\s+(?:--help|-h)(?:\s|$)/.test(command);

export const guardTaskRunCommand = (
  context: TaskIsolationContext,
  command: string,
): CommandGuardResult => {
  if (!isTaskIsolatedRun(context)) return { allowed: true };

  if (!isLhCommand(command)) {
    return {
      allowed: false,
      stderr: 'Only LobeHub `lh` CLI commands are allowed for this task run.',
    };
  }

  if (isBlockedTaskResourceCommand(command)) {
    return {
      allowed: false,
      stderr: 'Agent, file, document, and knowledge-base CLI access is disabled for this task run.',
    };
  }

  if (isTaskSearchCommand(command) && !isAllowedTaskSearchCommand(command)) {
    return {
      allowed: false,
      stderr:
        'Local LobeHub resource search is disabled for this task run. Use `lh search --web` for web search.',
    };
  }

  return { allowed: true };
};

const sanitizeTaskLhHelpOutput = (output: string) =>
  output
    .split('\n')
    .filter((line) => {
      const normalized = line.trim();

      if (/^(?:agent|doc|file|kb)\s/.test(normalized)) return false;
      if (normalized.includes('Knowledge base')) return false;
      if (normalized.includes('Manage knowledge bases')) return false;
      if (normalized.includes('Manage documents')) return false;
      if (normalized.includes('Manage files')) return false;
      if (normalized.includes('Manage agents')) return false;
      if (normalized.includes('Filter by type: agent,')) return false;
      if (normalized.includes('message, page, memory, mcp, plugin,')) return false;
      if (normalized.includes('communityAgent, knowledgeBase')) return false;
      if (normalized.includes('or type:id for local')) return false;

      return true;
    })
    .join('\n')
    .replaceAll('Search across local resources or the web', 'Search the web')
    .replaceAll('Search the web instead of local resources', 'Search the web')
    .trim();

const sanitizeTaskMessageListOutput = (output: string) => {
  try {
    const messages = JSON.parse(output.trim()) as unknown;
    if (!Array.isArray(messages)) throw new Error('Expected a JSON array');

    return JSON.stringify(
      messages
        .filter((message): message is Record<string, unknown> => {
          if (!message || typeof message !== 'object') return false;

          return (
            (message.role === 'user' || message.role === 'assistant') &&
            typeof message.content === 'string' &&
            message.content.trim().length > 0
          );
        })
        .map(({ content, createdAt, id, role, topicId, updatedAt }) => ({
          content,
          createdAt,
          id,
          role,
          topicId,
          updatedAt,
        })),
      null,
      2,
    );
  } catch {
    return 'Message history output was omitted for this task run because it was not structured JSON. Re-run with --json to retrieve sanitized user and assistant text only.';
  }
};

export const sanitizeTaskCommandResult = (
  context: TaskIsolationContext,
  command: string,
  result: CommandResult,
): CommandResult => {
  if (!isTaskIsolatedRun(context) || !result.success) return result;

  if (isTaskLhHelpCommand(command)) {
    return {
      ...result,
      output: sanitizeTaskLhHelpOutput(result.output),
    };
  }

  if (!isTaskMessageListCommand(command)) return result;

  return {
    ...result,
    output: sanitizeTaskMessageListOutput(result.output),
  };
};
