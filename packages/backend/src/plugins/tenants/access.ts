import type express from 'express';
import type { Config } from '@backstage/config';
import type { HttpAuthService, UserInfoService } from '@backstage/backend-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import { getUserGroupIds } from './graphClient';

export interface PlatformTenant {
  adGroupId: string;
  clientCode: string;
  tenantId: string;
  name: string;
  onPremConfig?: Config;
  azureConfig?: Config;
}

export function readPlatformTenants(config: Config): PlatformTenant[] {
  const entries = config.getOptionalConfigArray('platformTenants.tenants') ?? [];
  return entries.map(entry => ({
    adGroupId: entry.getString('adGroupId'),
    clientCode: entry.getString('clientCode'),
    tenantId: entry.getString('tenantId'),
    name: entry.getString('name'),
    onPremConfig: entry.getOptionalConfig('onPrem'),
    azureConfig: entry.getOptionalConfig('azure'),
  }));
}

/**
 * Resolves the calling request's Azure AD object id from its Backstage
 * user credentials — the sign-in resolver in ../auth/microsoftSignIn.ts
 * names each user's entity after that id specifically so it can be
 * recovered here, without needing a custom token claim.
 */
export async function getCallerAdObjectId(
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
 * Looks up a tenant by id and verifies the given AD object id is
 * currently a member of its AD group, checked live via Microsoft Graph.
 * Returns undefined if the tenant doesn't exist or the caller lacks
 * access — callers should treat both cases identically (403), so as not
 * to leak which tenant ids exist to users without access to them.
 */
export async function resolveTenantForCaller(
  config: Config,
  tenantId: string,
  adObjectId: string,
): Promise<PlatformTenant | undefined> {
  const tenant = readPlatformTenants(config).find(t => t.tenantId === tenantId);
  if (!tenant) return undefined;

  const groupIds = await getUserGroupIds(config, adObjectId);
  if (!groupIds.includes(tenant.adGroupId)) return undefined;

  return tenant;
}
