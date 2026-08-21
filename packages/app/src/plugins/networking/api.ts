import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import type { ResourceGroup, Nsg, NsgRule, RuleInput, DeployTarget } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export class NetworkingApi {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  private async baseUrl() {
    return this.discoveryApi.getBaseUrl('networking');
  }

  async listResourceGroups(tenantId: string): Promise<ResourceGroup[]> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/tenants/${tenantId}/resource-groups`);
    return json(res);
  }

  async createResourceGroup(
    tenantId: string,
    input: { name: string; description?: string; target: DeployTarget },
  ): Promise<ResourceGroup> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/tenants/${tenantId}/resource-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return json(res);
  }

  async deleteResourceGroup(id: string): Promise<void> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/resource-groups/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete resource group: ${res.status}`);
  }

  async listNsgs(resourceGroupId: string): Promise<Nsg[]> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/resource-groups/${resourceGroupId}/nsgs`);
    return json(res);
  }

  async createNsg(resourceGroupId: string, name: string): Promise<Nsg> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/resource-groups/${resourceGroupId}/nsgs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return json(res);
  }

  async deleteNsg(id: string): Promise<void> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/nsgs/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete NSG: ${res.status}`);
  }

  async listRules(nsgId: string): Promise<NsgRule[]> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/nsgs/${nsgId}/rules`);
    return json(res);
  }

  async createRule(nsgId: string, rule: RuleInput): Promise<NsgRule> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/nsgs/${nsgId}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return json(res);
  }

  async deleteRule(id: string): Promise<void> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}/rules/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete rule: ${res.status}`);
  }
}
