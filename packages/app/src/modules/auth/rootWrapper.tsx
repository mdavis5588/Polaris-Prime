import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import { TenantProvider } from '../../plugins/tenantSwitcher/TenantContext';

/**
 * Makes the current-tenant context available everywhere in the app,
 * including inside the sidebar (for the TenantSwitcher) and any future
 * page that needs to know which tenant the signed-in user is working in.
 */
export const tenantRootWrapper = AppRootWrapperBlueprint.make({
  params: {
    component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
  },
});

export default tenantRootWrapper;
