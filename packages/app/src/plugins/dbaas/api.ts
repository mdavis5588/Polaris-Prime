import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import type { DbaasWizardState } from './types';

export interface ClientOption {
  code: string;
  name: string;
  tenants: { id: string; name: string }[];
}

/**
 * Fetches the sanitized client/tenant list — code/name only, no cloud
 * credentials — from the dbaas-tenants backend plugin.
 */
export async function fetchClients(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<ClientOption[]> {
  const baseUrl = await discoveryApi.getBaseUrl('dbaas-tenants');
  const res = await fetchApi.fetch(`${baseUrl}/clients`);
  if (!res.ok) return [];
  return res.json();
}

export interface ProvisionResult {
  ok: boolean;
  automated: boolean;
  message?: string;
  error?: string;
  dbSystemId?: string;
  vmId?: string;
  consoleUrl?: string;
}

/**
 * Submits the wizard's accumulated answers to the dbaas backend plugin's
 * /provision route — the direct replacement for what used to be scaffolder
 * template steps/actions.
 */
export async function submitProvisioning(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  form: DbaasWizardState,
): Promise<ProvisionResult> {
  const baseUrl = await discoveryApi.getBaseUrl('dbaas');
  const res = await fetchApi.fetch(`${baseUrl}/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  const data = await res.json();
  return { ok: res.ok, ...data };
}
