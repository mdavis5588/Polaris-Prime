import Router from 'express-promise-router';
import express from 'express';
import type { Config } from '@backstage/config';

/**
 * Serves a sanitized client/tenant list for the oracle-dbaas template's
 * Client and Tenant pickers — code/name only. Tenants here are simple
 * tracking/cost-attribution tags (not tied to any specific cloud account),
 * so no 'target' is exposed. The actual OCI/Azure credentials in
 * oracleDbaas.clients[].oci/azure never leave the backend; they're only
 * read by the scaffolder actions at provisioning time, keyed by the
 * client code picked here.
 */
export async function createRouter({
  config,
}: {
  config: Config;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  router.get('/clients', async (_req, res) => {
    const clients = config.getOptionalConfigArray('oracleDbaas.clients') ?? [];
    res.json(
      clients.map(client => ({
        code: client.getString('code'),
        name: client.getString('name'),
        tenants: (client.getOptionalConfigArray('tenants') ?? []).map(tenant => ({
          id: tenant.getString('id'),
          name: tenant.getString('name'),
        })),
      })),
    );
  });

  return router;
}
