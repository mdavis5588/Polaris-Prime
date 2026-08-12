import { SignInPage as BackstageSignInPage } from '@backstage/core-components';
import { microsoftAuthApiRef } from '@backstage/core-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import type { SignInPageProps } from '@backstage/plugin-app-react';

/**
 * Offers both Guest (no setup needed, works out of the box) and Microsoft
 * (Entra ID / Azure AD) sign-in. Microsoft sign-in only actually works once
 * auth.providers.microsoft is configured in app-config.yaml — until then
 * it'll just error out if picked, same as any other unconfigured provider.
 */
export const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => (props: SignInPageProps) => (
      <BackstageSignInPage
        {...props}
        providers={[
          'guest',
          {
            id: 'microsoft-auth-provider',
            title: 'Microsoft',
            message: 'Sign in with your organization Microsoft account',
            apiRef: microsoftAuthApiRef,
          },
        ]}
      />
    ),
  },
});

export default signInPage;
