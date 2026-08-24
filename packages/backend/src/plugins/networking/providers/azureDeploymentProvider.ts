import type { Config } from '@backstage/config';
import { ClientSecretCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { NetworkManagementClient } from '@azure/arm-network';
import type { DeploymentProvider } from './deploymentTypes';
import { resourceGroupNameFromId } from './armIds';

// A generic, well-known default so this works out of the box without
// asking the user to pick a marketplace image for a plain IaaS VM. Swap
// this out (or make it configurable) once there's a real product need
// for something else.
const DEFAULT_IMAGE = {
  publisher: 'Canonical',
  offer: '0001-com-ubuntu-server-jammy',
  sku: '22_04-lts-gen2',
  version: 'latest',
};

/**
 * Deploys a service as an Azure IaaS VM into the given resource group —
 * the same approach the DBaaS Azure action already uses for Oracle VMs,
 * generalized to any service. Optionally attaches an NSG to the VM's NIC.
 */
export function createAzureDeploymentProvider(azureConfig: Config): DeploymentProvider {
  const subscriptionId = azureConfig.getString('subscriptionId');
  const tenantId = azureConfig.getString('tenantId');
  const clientId = azureConfig.getString('clientId');
  const clientSecret = azureConfig.getString('clientSecret');
  const location = azureConfig.getString('location');
  const subnetId = azureConfig.getString('subnetId');

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const networkClient = new NetworkManagementClient(credential, subscriptionId);
  const computeClient = new ComputeManagementClient(credential, subscriptionId);

  return {
    async createDeployment({ resourceGroupExternalId, spec }) {
      const rgName = resourceGroupNameFromId(resourceGroupExternalId);
      const nicName = `${spec.name}-nic`;

      const nic = await networkClient.networkInterfaces.beginCreateOrUpdateAndWait(rgName, nicName, {
        location,
        ipConfigurations: [
          {
            name: `${spec.name}-ipconfig`,
            subnet: { id: subnetId },
          },
        ],
        networkSecurityGroup: spec.nsgExternalId ? { id: spec.nsgExternalId } : undefined,
      });

      const vm = await computeClient.virtualMachines.beginCreateOrUpdateAndWait(rgName, spec.name, {
        location,
        hardwareProfile: { vmSize: spec.vmSize },
        storageProfile: { imageReference: DEFAULT_IMAGE },
        osProfile: {
          computerName: spec.name,
          adminUsername: spec.adminUsername,
          adminPassword: spec.adminPassword,
        },
        networkProfile: {
          networkInterfaces: [{ id: nic.id, primary: true }],
        },
        tags: { managedBy: 'polaris-prime-networking' },
      });

      if (!vm.id) {
        throw new Error(`Azure did not return an id for VM ${spec.name}`);
      }
      const consoleUrl = `https://portal.azure.com/#@${tenantId}/resource${vm.id}/overview`;
      return { externalId: vm.id, consoleUrl };
    },

    async deleteDeployment({ resourceGroupExternalId, externalId }) {
      const rgName = resourceGroupNameFromId(resourceGroupExternalId);
      const vmName = externalId.split('/').pop() ?? externalId;
      await computeClient.virtualMachines.beginDeleteAndWait(rgName, vmName);
      // The NIC created alongside the VM is left behind intentionally —
      // deleting it requires knowing it's not in use by anything else,
      // and ARM will refuse resource group deletion with orphaned NICs
      // present anyway, surfacing the issue rather than hiding it.
    },
  };
}
