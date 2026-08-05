import type { CottiAgentAccessRule } from '@/types/cotti/agentAccess';

export interface AgentAccessRuleMemberPresentation {
  subtitle?: string;
  title: string;
}

export const getAgentAccessRuleMemberPresentation = (
  rule: CottiAgentAccessRule,
): AgentAccessRuleMemberPresentation => {
  const userName = rule.user?.fullName || rule.user?.username;
  const identity = rule.user?.email || rule.user?.normalizedEmail || rule.value;

  if (!userName) return { title: rule.value };

  return {
    subtitle: identity === userName ? undefined : identity,
    title: userName,
  };
};
