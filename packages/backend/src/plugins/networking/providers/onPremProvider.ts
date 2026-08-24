import type { Config } from '@backstage/config';
import type { NetworkProvider } from './types';
import {
  readNetBoxSettings,
  createVlan,
  deleteVlan,
  allocatePrefixForVlan,
  deletePrefix,
  createAccessList,
  deleteAccessList,
  createAccessListRule,
  deleteAccessListRuleByName,
} from './netboxClient';

const NOT_CONFIGURED =
  'On-prem networking requires platformTenants.netbox to be configured ' +
  '(see app-config.yaml) — it provisions VLANs and NSG-equivalent access ' +
  'lists via NetBox.';

/** externalId encoding for resource groups: "netbox:vlan=<id>;prefix=<id>" */
function encodeResourceGroupId(vlanId: number, prefixId: number): string {
  return `netbox:vlan=${vlanId};prefix=${prefixId}`;
}
function decodeResourceGroupId(externalId: string): { vlanId: number; prefixId: number } {
  const match = /^netbox:vlan=(\d+);prefix=(\d+)$/.exec(externalId);
  if (!match) throw new Error(`Not a NetBox resource group id: ${externalId}`);
  return { vlanId: Number(match[1]), prefixId: Number(match[2]) };
}

/** externalId encoding for NSGs: "netbox:acl=<id>" */
function encodeNsgId(accessListId: number): string {
  return `netbox:acl=${accessListId}`;
}
function decodeNsgId(externalId: string): number {
  const match = /^netbox:acl=(\d+)$/.exec(externalId);
  if (!match) throw new Error(`Not a NetBox access list id: ${externalId}`);
  return Number(match[1]);
}

/**
 * Provisions on-prem networking (VLANs + IP allocation via NetBox core,
 * NSG-equivalent access lists via the community netbox-acls plugin —
 * see netboxClient.ts for the caveat on that plugin's API stability).
 *
 * This covers networking only. NetBox is IPAM/DCIM, not a hypervisor or
 * compute orchestrator, so actually deploying a service onto this VLAN
 * is a separate concern — see onPremDeploymentProvider.ts, still a stub
 * pending the orchestrator API contract in
 * docs/orchestrator-api-contract.md. Applying these VLANs/ACLs to real
 * switches is also a separate step (a NetBox webhook triggering an
 * Ansible/Nornir job, typically) — NetBox itself only holds the desired
 * state, matching how it's used everywhere else.
 */
export function createOnPremNetworkProvider(
  netboxConfig: Config | undefined,
  siteId: number | undefined,
): NetworkProvider {
  if (!netboxConfig) {
    return {
      async createResourceGroup() {
        throw new Error(NOT_CONFIGURED);
      },
      async deleteResourceGroup() {
        throw new Error(NOT_CONFIGURED);
      },
      async createNsg() {
        throw new Error(NOT_CONFIGURED);
      },
      async deleteNsg() {
        throw new Error(NOT_CONFIGURED);
      },
      async addRule() {
        throw new Error(NOT_CONFIGURED);
      },
      async removeRule() {
        throw new Error(NOT_CONFIGURED);
      },
    };
  }

  const settings = readNetBoxSettings(netboxConfig);

  return {
    async createResourceGroup({ name }) {
      const vlan = await createVlan(settings, { name: `rg-${name}`, siteId });
      const prefix = await allocatePrefixForVlan(settings, vlan.id);
      return { externalId: encodeResourceGroupId(vlan.id, prefix.id) };
    },

    async deleteResourceGroup({ externalId }) {
      const { vlanId, prefixId } = decodeResourceGroupId(externalId);
      await deletePrefix(settings, prefixId);
      await deleteVlan(settings, vlanId);
    },

    async createNsg({ resourceGroupExternalId, name }) {
      const { vlanId } = decodeResourceGroupId(resourceGroupExternalId);
      const acl = await createAccessList(settings, { name, vlanId });
      return { externalId: encodeNsgId(acl.id) };
    },

    async deleteNsg({ externalId }) {
      await deleteAccessList(settings, decodeNsgId(externalId));
    },

    async addRule({ nsgExternalId, rule }) {
      await createAccessListRule(settings, { accessListId: decodeNsgId(nsgExternalId), rule });
    },

    async removeRule({ nsgExternalId, ruleName }) {
      await deleteAccessListRuleByName(settings, decodeNsgId(nsgExternalId), ruleName);
    },
  };
}
