/** Only show account-switch guidance for an explicit authorization denial. */
export const isMarketAuthorizationDenied = (error: unknown): boolean =>
  error instanceof Error &&
  /access_denied|denied (?:the )?authorization|user denied/i.test(error.message);
