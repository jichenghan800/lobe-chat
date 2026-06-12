import type {
  CottiAgentAccessMode,
  CottiAgentAccessRuleItem,
  CottiAgentAccessRuleType,
} from '@/database/schemas';

export type AgentAccessMode = CottiAgentAccessMode;
export type AgentAccessRuleType = CottiAgentAccessRuleType;
export type AgentAccessSource = 'database' | 'environment';

export interface AgentAccessDetail {
  mode: AgentAccessMode;
  rules: CottiAgentAccessRuleItem[];
  source: AgentAccessSource;
}
