export const COTTI_MARKETPLACE_AGENT_MODEL = 'gemini-3.1-flash-lite';
export const COTTI_MARKETPLACE_AGENT_PROVIDER = 'vertexai';

export const applyCottiMarketplaceModel = <T extends object>(
  config: T,
): T & {
  model: string;
  provider: string;
} => ({
  ...config,
  model: COTTI_MARKETPLACE_AGENT_MODEL,
  provider: COTTI_MARKETPLACE_AGENT_PROVIDER,
});
