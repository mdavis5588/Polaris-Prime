/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin (available for future software-component templates;
// the DBaaS wizard itself is a plain plugin page, not a scaffolder template
// — see ./plugins/dbaas)
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// Database as a Service provisioning (OCI/Azure)
backend.add(import('./plugins/dbaas/plugin'));

// SAM-tool (Helios) pricing data
backend.add(import('./plugins/samPricing/plugin'));

// dbaas client/tenant list
backend.add(import('./plugins/dbaasTenants/plugin'));

// Platform-wide, Azure-AD-group-gated tenant access (hybrid on-prem/Azure
// service deployment) — see ./plugins/tenants
backend.add(import('./plugins/tenants/plugin'));

// Resource Groups / NSGs — the same model on-prem and Azure — see
// ./plugins/networking
backend.add(import('./plugins/networking/plugin'));

// techdocs plugin
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// See https://backstage.io/docs/auth/guest/provider

// Microsoft (Entra ID / Azure AD) sign-in, with a custom resolver — see
// ./plugins/auth/microsoftSignIn. Kept alongside guest auth so local dev
// still works without an Azure AD app registration configured; once
// AZURE_AD_* env vars are set, users can choose Microsoft on the sign-in
// page to get a real, tenant-gated identity.
backend.add(import('./plugins/auth/microsoftSignIn'));

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// See https://backstage.io/docs/permissions/getting-started for how to create your own permission policy
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
);

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));

// user settings plugin
backend.add(import('@backstage/plugin-user-settings-backend'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

// mcp actions plugin
backend.add(import('@backstage/plugin-mcp-actions-backend'));

backend.start();
