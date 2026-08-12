import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export interface MyTenant {
  clientCode: string;
  tenantId: string;
  name: string;
  hasOnPrem: boolean;
  hasAzure: boolean;
}

/**
 * Fetches the caller's real, access-controlled tenant list from the
 * tenants backend plugin — re-verified against live Azure AD group
 * membership on every call, not cached client-side across sessions.
 */
export async function fetchMyTenants(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<MyTenant[]> {
  const baseUrl = await discoveryApi.getBaseUrl('tenants');
  const res = await fetchApi.fetch(`${baseUrl}/mine`);
  if (!res.ok) return [];
  return res.json();
}
