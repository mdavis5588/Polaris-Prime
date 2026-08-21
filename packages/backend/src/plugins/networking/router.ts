import Router from 'express-promise-router';
import express from 'express';
import type { Config } from '@backstage/config';
import type { HttpAuthService, UserInfoService } from '@backstage/backend-plugin-api';
import { getCallerAdObjectId, resolveTenantForCaller, PlatformTenant } from '../tenants/access';
import { NetworkingStore, ResourceGroupRecord } from './store';
import { createAzureNetworkProvider } from './providers/azureProvider';
import { createOnPremNetworkProvider } from './providers/onPremProvider';
import type { NetworkProvider, RuleSpec } from './providers/types';

function parseTenantKey(tenantKey: string): { clientCode: string; tenantId: string } {
  const [clientCode, tenantId] = tenantKey.split(':');
  return { clientCode, tenantId };
}

function getProvider(target: 'azure' | 'onprem', tenant: PlatformTenant): NetworkProvider {
  if (target === 'onprem') {
    return createOnPremNetworkProvider();
  }
  if (!tenant.azureConfig) {
    throw new Error(`Tenant ${tenant.tenantId} has no azure config`);
  }
  return createAzureNetworkProvider(tenant.azureConfig);
}

/**
 * Resource Group / NSG / rule CRUD, scoped to a tenant and target
 * (azure|onprem) so the IDP presents the same model regardless of where
 * things actually get deployed — see docs/orchestrator-api-contract.md
 * for what's still needed before the on-prem side is more than a stub.
 * Every route re-verifies the caller's tenant access independently,
 * including on routes that only take a resource-group/NSG/rule id, by
 * walking back up to the owning tenant first.
 */
export async function createRouter({
  config,
  httpAuth,
  userInfo,
  store,
}: {
  config: Config;
  httpAuth: HttpAuthService;
  userInfo: UserInfoService;
  store: NetworkingStore;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  async function requireTenant(req: express.Request, tenantId: string) {
    const adObjectId = await getCallerAdObjectId(req, httpAuth, userInfo);
    return resolveTenantForCaller(config, tenantId, adObjectId);
  }

  /** Resolves a resource group and re-verifies the caller has access to the tenant that owns it. */
  async function requireResourceGroup(
    req: express.Request,
    id: string,
  ): Promise<{ rg: ResourceGroupRecord; tenant: PlatformTenant } | undefined> {
    const rg = await store.getResourceGroup(id);
    if (!rg) return undefined;
    const { tenantId } = parseTenantKey(rg.tenant_key);
    const tenant = await requireTenant(req, tenantId);
    if (!tenant) return undefined;
    return { rg, tenant };
  }

  // --- Resource groups ---

  router.get('/tenants/:tenantId/resource-groups', async (req, res) => {
    const tenant = await requireTenant(req, req.params.tenantId);
    if (!tenant) {
      res.status(403).json({ error: 'You do not have access to this tenant' });
      return;
    }
    const groups = await store.listResourceGroups(tenant.clientCode, tenant.tenantId);
    res.json(groups);
  });

  router.post('/tenants/:tenantId/resource-groups', async (req, res) => {
    const tenant = await requireTenant(req, req.params.tenantId);
    if (!tenant) {
      res.status(403).json({ error: 'You do not have access to this tenant' });
      return;
    }
    const { name, description, target } = req.body as {
      name: string;
      description?: string;
      target: 'azure' | 'onprem';
    };
    if (target === 'azure' && !tenant.azureConfig) {
      res.status(400).json({ error: 'This tenant has no Azure account configured' });
      return;
    }
    if (target === 'onprem' && !tenant.onPremConfig) {
      res.status(400).json({ error: 'This tenant has no on-prem resource pool configured' });
      return;
    }

    const id = await store.createResourceGroup({
      clientCode: tenant.clientCode,
      tenantId: tenant.tenantId,
      target,
      name,
      description,
    });

    try {
      const provider = getProvider(target, tenant);
      const { externalId } = await provider.createResourceGroup({ name });
      await store.markResourceGroupResult(id, { status: 'active', externalId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.markResourceGroupResult(id, { status: 'failed', error: message });
    }

    res.status(201).json(await store.getResourceGroup(id));
  });

  router.delete('/resource-groups/:id', async (req, res) => {
    const resolved = await requireResourceGroup(req, req.params.id);
    if (!resolved) {
      res.status(403).json({ error: 'You do not have access to this resource group' });
      return;
    }
    const { rg, tenant } = resolved;
    if (rg.external_id) {
      const provider = getProvider(rg.target, tenant);
      await provider.deleteResourceGroup({ externalId: rg.external_id });
    }
    await store.deleteResourceGroup(rg.id);
    res.status(204).end();
  });

  // --- NSGs ---

  router.get('/resource-groups/:id/nsgs', async (req, res) => {
    const resolved = await requireResourceGroup(req, req.params.id);
    if (!resolved) {
      res.status(403).json({ error: 'You do not have access to this resource group' });
      return;
    }
    res.json(await store.listNsgs(resolved.rg.id));
  });

  router.post('/resource-groups/:id/nsgs', async (req, res) => {
    const resolved = await requireResourceGroup(req, req.params.id);
    if (!resolved) {
      res.status(403).json({ error: 'You do not have access to this resource group' });
      return;
    }
    const { rg, tenant } = resolved;
    if (rg.status !== 'active' || !rg.external_id) {
      res.status(409).json({ error: 'Resource group is not active yet' });
      return;
    }
    const { name } = req.body as { name: string };

    const id = await store.createNsg({ resourceGroupId: rg.id, name });
    try {
      const provider = getProvider(rg.target, tenant);
      const { externalId } = await provider.createNsg({
        resourceGroupExternalId: rg.external_id,
        name,
      });
      await store.markNsgResult(id, { status: 'active', externalId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.markNsgResult(id, { status: 'failed', error: message });
    }

    res.status(201).json(await store.getNsg(id));
  });

  router.delete('/nsgs/:id', async (req, res) => {
    const nsg = await store.getNsg(req.params.id);
    if (!nsg) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const resolved = await requireResourceGroup(req, nsg.resource_group_id);
    if (!resolved) {
      res.status(403).json({ error: 'You do not have access to this NSG' });
      return;
    }
    const { rg, tenant } = resolved;
    if (nsg.external_id) {
      const provider = getProvider(rg.target, tenant);
      await provider.deleteNsg({ externalId: nsg.external_id });
    }
    await store.deleteNsg(nsg.id);
    res.status(204).end();
  });

  // --- Rules ---

  router.get('/nsgs/:id/rules', async (req, res) => {
    const nsg = await store.getNsg(req.params.id);
    if (!nsg) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const resolved = await requireResourceGroup(req, nsg.resource_group_id);
    if (!resolved) {
      res.status(403).json({ error: 'You do not have access to this NSG' });
      return;
    }
    res.json(await store.listRules(nsg.id));
  });

  router.post('/nsgs/:id/rules', async (req, res) => {
    const nsg = await store.getNsg(req.params.id);
    if (!nsg) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const resolved = await requireResourceGroup(req, nsg.resource_group_id);
    if (!resolved) {
      res.status(403).json({ error: 'You do not have access to this NSG' });
      return;
    }
    const { rg, tenant } = resolved;
    if (nsg.status !== 'active' || !nsg.external_id) {
      res.status(409).json({ error: 'NSG is not active yet' });
      return;
    }
    const rule = req.body as RuleSpec;

    const id = await store.createRule({ nsgId: nsg.id, rule });
    try {
      const provider = getProvider(rg.target, tenant);
      await provider.addRule({ nsgExternalId: nsg.external_id, rule });
      await store.markRuleResult(id, { status: 'active' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.markRuleResult(id, { status: 'failed', error: message });
    }

    res.status(201).json(await store.getRule(id));
  });

  router.delete('/rules/:id', async (req, res) => {
    const rule = await store.getRule(req.params.id);
    if (!rule) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const nsg = await store.getNsg(rule.nsg_id);
    if (!nsg) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const resolved = await requireResourceGroup(req, nsg.resource_group_id);
    if (!resolved) {
      res.status(403).json({ error: 'You do not have access to this rule' });
      return;
    }
    const { rg, tenant } = resolved;
    if (nsg.external_id && rule.status === 'active') {
      const provider = getProvider(rg.target, tenant);
      await provider.removeRule({ nsgExternalId: nsg.external_id, ruleName: rule.name });
    }
    await store.deleteRule(rule.id);
    res.status(204).end();
  });

  return router;
}
