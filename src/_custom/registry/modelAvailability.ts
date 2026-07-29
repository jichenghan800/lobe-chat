interface ModelLike {
  id: string;
}

interface ProviderModelListLike<T extends ModelLike> {
  children: T[];
  id: string;
}

export const COTTI_CHAT_DEFAULT_MODEL = {
  model: 'gemini-3.5-flash-lite',
  provider: 'vertexai',
} as const;

export const COTTI_AGENT_DEFAULT_MODEL = {
  model: 'gemini-3.6-flash',
  provider: 'vertexai',
} as const;

const AGENT_ONLY_CHAT_MODEL_IDS = new Set(['doubao-seed-2-1-pro-260628', 'glm-5.2', 'gpt-5.5']);

const CHAT_ONLY_MODEL_IDS = new Set(['gemini-3.5-flash-lite']);

export const isAgentOnlyChatModel = (modelId: string) =>
  AGENT_ONLY_CHAT_MODEL_IDS.has(modelId.trim().toLowerCase());

export const isChatOnlyModel = (modelId: string) =>
  CHAT_ONLY_MODEL_IDS.has(modelId.trim().toLowerCase());

export const isAgentModelRoute = (pathname: string) =>
  pathname === '/agent' ||
  pathname.startsWith('/agent/') ||
  pathname.startsWith('/popup/agent/') ||
  /^\/[^/]+\/agent(?:\/|$)/.test(pathname);

interface AgentOnlyModelVisibilityOptions {
  enableAgentMode: boolean;
  enableCottiAgentAccess: boolean;
}

export const shouldIncludeAgentOnlyChatModels = ({
  enableAgentMode,
  enableCottiAgentAccess,
}: AgentOnlyModelVisibilityOptions) => enableCottiAgentAccess && enableAgentMode;

const filterProviderModelLists = <T extends ModelLike, P extends ProviderModelListLike<T>>(
  providers: P[],
  predicate: (model: T) => boolean,
) =>
  providers
    .map((provider) => ({
      ...provider,
      children: provider.children.filter(predicate),
    }))
    .filter((provider) => provider.children.length > 0);

export const filterChatModeModelLists = <T extends ModelLike, P extends ProviderModelListLike<T>>(
  providers: P[],
) => filterProviderModelLists(providers, (model) => !isAgentOnlyChatModel(model.id));

export const filterAgentModeModelLists = <T extends ModelLike, P extends ProviderModelListLike<T>>(
  providers: P[],
) => filterProviderModelLists(providers, (model) => !isChatOnlyModel(model.id));

export const filterAgentOnlyChatModels = filterChatModeModelLists;

export const getCottiModeFallbackConfig = ({
  enableAgentMode,
  modelId,
}: {
  enableAgentMode: boolean;
  modelId: string;
}) => {
  if (enableAgentMode && isChatOnlyModel(modelId)) return COTTI_AGENT_DEFAULT_MODEL;
  if (!enableAgentMode && isAgentOnlyChatModel(modelId)) return COTTI_CHAT_DEFAULT_MODEL;
};
