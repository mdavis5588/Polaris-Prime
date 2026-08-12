import Router from 'express-promise-router';
import express from 'express';
import type { Config } from '@backstage/config';
import type { HttpAuthService, UserInfoService } from '@backstage/backend-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import { getUserGroupIds } from './graphClient';

interface TenantConfigEntry {
  adGroupId: string;
  clientCode: string;
  tenantId: string;
  name: string;
  hasOnPrem: boolean;
  hasAzure: boolean;
}

function readTenants(config: Config): TenantConfigEntry[] {
  const entries = config.getOptionalConfigArray('platformTenants.tenants') ?? [];
  return entries.map(entry => ({
    adGroupId: entry.getString('adGroupId'),
    clientCode: entry.getString('clientCode'),
    tenantId: entry.getString('tenantId'),
    name: entry.getString('name'),
    hasOnPrem: Boolean(entry.getOptionalConfig('onPrem')),
    hasAzure: Boolean(entry.getOptionalConfig('azure')),
  }));
}

/**
 * Resolves the calling request's Azure AD object id from its Backstage
 * user credentials — the sign-in resolver in ../auth/microsoftSignIn.ts
 * names each user's entity after that id specifically so it can be
 * recovered here, without needing a custom token claim.
 */
async function getCallerAdObjectId(
  req: express.Request,
  httpAuth: HttpAuthService,
  userInfo: UserInfoService,
): Promise<string> {
  const credentials = await httpAuth.credentials(req, { allow: ['user'] });
  const info = await userInfo.getUserInfo(credentials);
  const { name } = parseEntityRef(info.userEntityRef, { defaultKind: 'user' });
  return name;
}

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

    const myTenants = readTenants(config)
      .filter(t => groupIds.has(t.adGroupId))
      .map(({ adGroupId: _adGroupId, ...rest }) => rest);

    res.json(myTenants);
  });

  router.post('/:tenantId/deploy', async (req, res) => {
    const adObjectId = await getCallerAdObjectId(req, httpAuth, userInfo);
    const groupIds = new Set(await getUserGroupIds(config, adObjectId));

    const tenant = readTenants(config).find(t => t.tenantId === req.params.tenantId);
    if (!tenant || !groupIds.has(tenant.adGroupId)) {
      res.status(403).json({ error: 'You do not have access to this tenant' });
      return;
    }

    // The orchestrator API contract isn't defined yet — same open question
    // as the earlier on-prem DBaaS placeholder. Once it exists, this
    // should POST the service spec plus tenant.onPrem/azure resource
    // identifiers to it.
    res.status(501).json({
      error:
        'Service deployment is not yet implemented — pending the orchestrator API contract.',
    });
  });

  return router;
}
