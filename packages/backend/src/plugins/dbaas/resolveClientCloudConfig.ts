import type { Config } from '@backstage/config';

/**
 * Resolves a client's cloud account config for the given target — one OCI
 * tenancy and/or one Azure subscription per client, not per tenant tag.
 * None of this ever reaches the browser; only client codes and tenant
 * tag ids/names do, via the dbaas-tenants backend plugin's sanitized list.
 */
export function resolveClientCloudConfig(
  config: Config,
  clientCode: string,
  target: 'oci' | 'azure',
): Config {
  const clients = config.getOptionalConfigArray('oracleDbaas.clients') ?? [];
  const client = clients.find(c => c.getString('code') === clientCode);
  if (!client) {
    throw new Error(`Unknown client code: ${clientCode}`);
  }

  const targetConfig = client.getOptionalConfig(target);
  if (!targetConfig) {
    throw new Error(
      `Client ${clientCode} has no '${target}' config block configured`,
    );
  }
  return targetConfig;
}

/**
 * Validates that the given tenant tag id belongs to the client, so a
 * provisioning action can reject a spoofed/stale tag before tagging
 * cloud resources with it. Returns the tenant's display name for logging.
 */
export function resolveTenantTagName(
  config: Config,
  clientCode: string,
  tenantTag: string,
): string {
  const clients = config.getOptionalConfigArray('oracleDbaas.clients') ?? [];
  const client = clients.find(c => c.getString('code') === clientCode);
  if (!client) {
    throw new Error(`Unknown client code: ${clientCode}`);
  }

  const tenants = client.getOptionalConfigArray('tenants') ?? [];
  const tenant = tenants.find(t => t.getString('id') === tenantTag);
  if (!tenant) {
    throw new Error(`Unknown tenant tag: ${tenantTag} for client ${clientCode}`);
  }
  return tenant.getString('name');
}
