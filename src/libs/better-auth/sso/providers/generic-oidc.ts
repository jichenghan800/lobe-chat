import { authEnv } from '@/envs/auth';

import { buildOidcConfig } from '../helpers';
import { type GenericProviderDefinition } from '../types';

const provider: GenericProviderDefinition<{
  AUTH_GENERIC_OIDC_ID: string;
  AUTH_GENERIC_OIDC_ISSUER: string;
  AUTH_GENERIC_OIDC_SECRET: string;
}> = {
  build: (env) =>
    buildOidcConfig({
      clientId: env.AUTH_GENERIC_OIDC_ID,
      clientSecret: env.AUTH_GENERIC_OIDC_SECRET,
      issuer: env.AUTH_GENERIC_OIDC_ISSUER,
      overrides: {
        // Cotti AI Portal registers confidential clients with client_secret_basic.
        // Better Auth otherwise defaults to client_secret_post and the token endpoint
        // rejects the authorization code exchange as an invalid client.
        authentication: 'basic',
        /**
         * Mirror NextAuth's fallback that prefers name -> username -> email so Better Auth never
         * fails with name_is_missing when upstream profiles only expose username/email fields.
         */
        mapProfileToUser: (profile) => ({
          name: profile.name ?? profile.username ?? profile.email ?? profile.id,
        }),
      },
      providerId: 'generic-oidc',
    }),
  checkEnvs: () => {
    return !!(
      authEnv.AUTH_GENERIC_OIDC_ID &&
      authEnv.AUTH_GENERIC_OIDC_SECRET &&
      authEnv.AUTH_GENERIC_OIDC_ISSUER
    )
      ? {
          AUTH_GENERIC_OIDC_ID: authEnv.AUTH_GENERIC_OIDC_ID,
          AUTH_GENERIC_OIDC_ISSUER: authEnv.AUTH_GENERIC_OIDC_ISSUER,
          AUTH_GENERIC_OIDC_SECRET: authEnv.AUTH_GENERIC_OIDC_SECRET,
        }
      : false;
  },
  id: 'generic-oidc',
  type: 'generic',
};

export default provider;
