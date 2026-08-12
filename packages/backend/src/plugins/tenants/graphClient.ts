import type { Config } from '@backstage/config';

interface GraphTokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: GraphTokenCache | undefined;

/**
 * Obtains an app-only (client credentials) Microsoft Graph access token,
 * caching it until shortly before it expires. Requires the app
 * registration configured under platformTenants.graph to have been
 * granted a Graph API group-read APPLICATION permission (GroupMember.Read.All
 * or Directory.Read.All) with admin consent in the Azure AD tenant.
 */
async function getGraphAppToken(config: Config): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const graphConfig = config.getConfig('platformTenants.graph');
  const tenantId = graphConfig.getString('tenantId');
  const clientId = graphConfig.getString('clientId');
  const clientSecret = graphConfig.getString('clientSecret');

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to obtain Microsoft Graph app token: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return cachedToken.token;
}

/**
 * Returns the Azure AD group object ids the given user (identified by
 * their AD object id) directly belongs to. Called fresh on every
 * /tenants/mine and /tenants/:id/deploy request rather than cached, so
 * group membership changes in Azure AD take effect immediately.
 */
export async function getUserGroupIds(
  config: Config,
  adObjectId: string,
): Promise<string[]> {
  const token = await getGraphAppToken(config);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(adObjectId)}/memberOf?$select=id`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`Microsoft Graph memberOf lookup failed: ${res.status}`);
  }
  const data = (await res.json()) as { value?: { id?: string }[] };
  return (data.value ?? [])
    .map(item => item.id)
    .filter((id): id is string => Boolean(id));
}
