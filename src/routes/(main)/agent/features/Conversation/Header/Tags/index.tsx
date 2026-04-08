import { Flexbox } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { memo } from 'react';

import ModelDisplayNameTag from '@/_custom/components/ModelDisplayNameTag';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import PluginTag from '@/features/PluginTag';
import { useAgentEnableSearch } from '@/hooks/useAgentEnableSearch';
import { useModelSupportToolUse } from '@/hooks/useModelSupportToolUse';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';
import { useSessionStore } from '@/store/session';
import { sessionSelectors } from '@/store/session/selectors';

import KnowledgeTag from './KnowledgeTag';
import MemberCountTag from './MemberCountTag';
import SearchTags from './SearchTags';

const TitleTags = memo(() => {
  const [model, provider, hasKnowledge] = useAgentStore((s) => [
    agentSelectors.currentAgentModel(s),
    agentSelectors.currentAgentModelProvider(s),
    agentSelectors.hasKnowledge(s),
  ]);
  const plugins = useAgentStore(agentSelectors.displayableAgentPlugins, isEqual);
  const enabledKnowledge = useAgentStore(agentSelectors.currentEnabledKnowledge, isEqual);
  const isGroupSession = useSessionStore(sessionSelectors.isCurrentSessionGroupSession);
  const showPlugin = useModelSupportToolUse(model, provider);
  const isAgentEnableSearch = useAgentEnableSearch();

  if (isGroupSession) {
    return (
      <Flexbox horizontal align={'center'} gap={12}>
        <MemberCountTag />
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal align={'center'} gap={4}>
      <ModelSwitchPanel>
        <ModelDisplayNameTag model={model} provider={provider} />
      </ModelSwitchPanel>
      {isAgentEnableSearch && <SearchTags />}
      {showPlugin && plugins?.length > 0 && <PluginTag plugins={plugins} />}
      {hasKnowledge && <KnowledgeTag data={enabledKnowledge} />}
    </Flexbox>
  );
});

export default TitleTags;
