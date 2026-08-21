import Router from 'express-promise-router';
import express from 'express';
import type { Config } from '@backstage/config';
import type { HttpAuthService, UserInfoService } from '@backstage/backend-plugin-api';
import { getUserGroupIds } from './graphClient';
import { getCallerAdObjectId, readPlatformTenants, resolveTenantForCaller } from './access';

/**
 * Serves the caller's real, access-controlled tenant list (GET /mine) and
 * handles service-deployment requests scoped to a tenant (POST
 * /:tenantId/deploy). Tenant access is re-verified against live Azure AD
 * group membership on every call — never trusted from client input alone.
 */
export async function createRouter({
  config,
  httpAuth,
  userInfo,
}: {
  config: Config;
  httpAuth: HttpAuthService;
  userInfo: UserInfoService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  router.get('/mine', async (req, res) => {
    const adObjectId = await getCallerAdObjectId(req, httpAuth, userInfo);
    const groupIds = new Set(await getUserGroupIds(config, adObjectId));

    const myTenants = readPlatformTenants(config)
      .filter(t => groupIds.has(t.adGroupId))
      .map(t => ({
        clientCode: t.clientCode,
        tenantId: t.tenantId,
        name: t.name,
        hasOnPrem: Boolean(t.onPremConfig),
        hasAzure: Boolean(t.azureConfig),
      }));

    res.json(myTenants);
  });

  router.post('/:tenantId/deploy', async (req, res) => {
    const adObjectId = await getCallerAdObjectId(req, httpAuth, userInfo);
    const tenant = await resolveTenantForCaller(config, req.params.tenantId, adObjectId);
    if (!tenant) {
      res.status(403).json({ error: 'You do not have access to this tenant' });
      return;
    }

    // The orchestrator API contract isn't defined yet — see
    // docs/orchestrator-api-contract.md. Once it exists, this should POST
    // the service spec plus tenant.onPrem/azure resource identifiers to it.
    res.status(501).json({
      error:
        'Service deployment is not yet implemented — pending the orchestrator API contract.',
    });
  });

  return router;
}
