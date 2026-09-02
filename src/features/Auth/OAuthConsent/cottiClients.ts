export const COTTI_OIDC_CLIENT_IDS = [
  'cotticoffee-nano',
  'cotticoffee-ppt',
  'cotticoffee-comfyui',
] as const;

const cottiOidcClientIdSet: ReadonlySet<string> = new Set(COTTI_OIDC_CLIENT_IDS);

export const isCottiOidcClient = (clientId: string) => cottiOidcClientIdSet.has(clientId);
