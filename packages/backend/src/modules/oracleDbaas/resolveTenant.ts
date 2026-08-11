import type { Config } from '@backstage/config';

/**
 * Resolves a client + tenant selection made in the template UI down to
 * that tenant's actual cloud config (credentials, compartment/resource
 * group, etc.) — none of which the browser ever sees, only the
 * client/tenant code and id picked via the dbaas-tenants backend plugin's
 * sanitized list.
 */
export function resolveTenantConfig(
  config: Config,
  clientCode: string,
  tenantId: string,
  target: 'oci' | 'azure',
): Config {
  const clients = config.getOptionalConfigArray('oracleDbaas.clients') ?? [];
  const client = clients.find(c => c.getString('code') === clientCode);
  if (!client) {
    throw new Error(`Unknown client code: ${clientCode}`);
  }

  const tenants = client.getOptionalConfigArray('tenants') ?? [];
  const tenant = tenants.find(t => t.getString('id') === tenantId);
  if (!tenant) {
    throw new Error(`Unknown tenant id: ${tenantId} for client ${clientCode}`);
  }

  const tenantTarget = tenant.getString('target');
  if (tenantTarget !== target) {
    throw new Error(
      `Tenant ${tenantId} is a ${tenantTarget} tenant, not ${target}`,
    );
  }

  const tenantConfig = tenant.getOptionalConfig(target);
  if (!tenantConfig) {
    throw new Error(
      `Tenant ${tenantId} has no '${target}' config block configured`,
    );
  }
  return tenantConfig;
}
