import type { Config } from '@backstage/config';
import { ClientSecretCredential } from '@azure/identity';
import { ResourceManagementClient } from '@azure/arm-resources';
import { NetworkManagementClient } from '@azure/arm-network';
import type { NetworkProvider, RuleSpec } from './types';
import { resourceGroupNameFromId, lastSegment } from './armIds';

const PROTOCOL_MAP: Record<RuleSpec['protocol'], string> = {
  tcp: 'Tcp',
  udp: 'Udp',
  '*': '*',
};

/**
 * Maps Polaris's canonical Resource Group / NSG operations onto real
 * Azure Resource Manager and Network resources, using the given tenant's
 * Azure service principal (platformTenants.tenants[].azure).
 */
export function createAzureNetworkProvider(azureConfig: Config): NetworkProvider {
  const subscriptionId = azureConfig.getString('subscriptionId');
  const tenantId = azureConfig.getString('tenantId');
  const clientId = azureConfig.getString('clientId');
  const clientSecret = azureConfig.getString('clientSecret');
  const location = azureConfig.getString('location');

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const resourceClient = new ResourceManagementClient(credential, subscriptionId);
  const networkClient = new NetworkManagementClient(credential, subscriptionId);

  return {
    async createResourceGroup({ name }) {
      const rg = await resourceClient.resourceGroups.createOrUpdate(name, { location });
      if (!rg.id) {
        throw new Error(`Azure did not return an id for resource group ${name}`);
      }
      return { externalId: rg.id };
    },

    async deleteResourceGroup({ externalId }) {
      await resourceClient.resourceGroups.beginDeleteAndWait(
        resourceGroupNameFromId(externalId),
      );
    },

    async createNsg({ resourceGroupExternalId, name }) {
      const rgName = resourceGroupNameFromId(resourceGroupExternalId);
      const nsg = await networkClient.networkSecurityGroups.beginCreateOrUpdateAndWait(
        rgName,
        name,
        { location },
      );
      if (!nsg.id) {
        throw new Error(`Azure did not return an id for NSG ${name}`);
      }
      return { externalId: nsg.id };
    },

    async deleteNsg({ externalId }) {
      const rgName = resourceGroupNameFromId(externalId);
      await networkClient.networkSecurityGroups.beginDeleteAndWait(
        rgName,
        lastSegment(externalId),
      );
    },

    async addRule({ nsgExternalId, rule }) {
      const rgName = resourceGroupNameFromId(nsgExternalId);
      const nsgName = lastSegment(nsgExternalId);
      await networkClient.securityRules.beginCreateOrUpdateAndWait(rgName, nsgName, rule.name, {
        priority: rule.priority,
        direction: rule.direction === 'inbound' ? 'Inbound' : 'Outbound',
        access: rule.access === 'allow' ? 'Allow' : 'Deny',
        protocol: PROTOCOL_MAP[rule.protocol],
        sourceAddressPrefix: rule.sourceAddressPrefix,
        sourcePortRange: rule.sourcePortRange,
        destinationAddressPrefix: rule.destinationAddressPrefix,
        destinationPortRange: rule.destinationPortRange,
      });
    },

    async removeRule({ nsgExternalId, ruleName }) {
      const rgName = resourceGroupNameFromId(nsgExternalId);
      const nsgName = lastSegment(nsgExternalId);
      await networkClient.securityRules.beginDeleteAndWait(rgName, nsgName, ruleName);
    },
  };
}
