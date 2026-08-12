import { createBackendModule } from '@backstage/backend-plugin-api';
import { authProvidersExtensionPoint, createOAuthProviderFactory } from '@backstage/plugin-auth-node';
import { microsoftAuthenticator } from '@backstage/plugin-auth-backend-module-microsoft-provider';

/**
 * Registers the Microsoft (Entra ID / Azure AD) OAuth provider with a
 * custom sign-in resolver, instead of the packaged module's declarative
 * resolvers (which match against a pre-existing catalog User entity).
 * Polaris doesn't sync an org directory into the catalog, so sign-in just
 * identifies the user by their stable Azure AD object id (the `oid`
 * claim, exposed as `profile.id` by passport-microsoft) and creates a
 * Backstage identity for them on first login.
 *
 * Tenant access is NOT resolved here or baked into the sign-in token —
 * the tenants plugin's GET /mine route re-checks Microsoft Graph group
 * membership live on every call instead, so access changes in Azure AD
 * take effect immediately rather than only at next login.
 */
export const authModuleMicrosoftSignIn = createBackendModule({
  pluginId: 'auth',
  moduleId: 'microsoft-sign-in',
  register(reg) {
    reg.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'microsoft',
          factory: createOAuthProviderFactory({
            authenticator: microsoftAuthenticator,
            async signInResolver({ profile, result }, ctx) {
              const adObjectId = (result.fullProfile as { id?: string }).id;
              if (!adObjectId) {
                throw new Error(
                  'Microsoft sign-in did not return an account id (oid claim)',
                );
              }
              if (!profile.email) {
                throw new Error('Microsoft sign-in did not return an email address');
              }

              return ctx.signInWithCatalogUser(
                { entityRef: { kind: 'User', name: adObjectId } },
                {
                  dangerousEntityRefFallback: {
                    entityRef: { kind: 'User', name: adObjectId },
                  },
                },
              );
            },
          }),
        });
      },
    });
  },
});

export default authModuleMicrosoftSignIn;
