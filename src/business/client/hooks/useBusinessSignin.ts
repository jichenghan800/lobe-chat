export const useBusinessSignin = () => {
  return {
    getAdditionalData: async () => {
      return {};
    },
    preSocialSigninCheck: async () => {
      return true;
    },
    ssoProviderLabels: {} as Record<string, string | undefined>,
    ssoProviders: [],
  };
};
