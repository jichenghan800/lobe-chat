interface ModelLike {
  id: string;
}

interface ProviderModelListLike<T extends ModelLike> {
  children: T[];
  id: string;
}

const AGENT_ONLY_CHAT_MODEL_IDS = new Set(['gpt-5.5', 'glm-5.2']);

export const isAgentOnlyChatModel = (modelId: string) =>
  AGENT_ONLY_CHAT_MODEL_IDS.has(modelId.trim().toLowerCase());

export const isAgentModelRoute = (pathname: string) =>
  pathname === '/agent' ||
  pathname.startsWith('/agent/') ||
  pathname.startsWith('/popup/agent/') ||
  /^\/[^/]+\/agent(?:\/|$)/.test(pathname);

interface AgentOnlyModelVisibilityOptions {
  enableAgentMode: boolean;
  enableCottiAgentAccess: boolean;
  pathname: string;
}

export const shouldIncludeAgentOnlyChatModels = ({
  enableAgentMode,
  enableCottiAgentAccess,
  pathname,
}: AgentOnlyModelVisibilityOptions) =>
  isAgentModelRoute(pathname) && enableCottiAgentAccess && enableAgentMode;

export const filterAgentOnlyChatModels = <T extends ModelLike, P extends ProviderModelListLike<T>>(
  providers: P[],
) =>
  providers
    .map((provider) => ({
      ...provider,
      children: provider.children.filter((model) => !isAgentOnlyChatModel(model.id)),
    }))
    .filter((provider) => provider.children.length > 0);
