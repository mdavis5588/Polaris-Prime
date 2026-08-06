import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import type { Config } from '@backstage/config';
import { ClientSecretCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { NetworkManagementClient } from '@azure/arm-network';

/**
 * Provisions an Oracle-ready VM on Azure sized per the selection in the
 * oracle-dbaas template. Networking (resource group, subnet) and the base
 * image reference come from platform-level config, not user input.
 *
 * Note: Azure has no native Oracle DBaaS offering (unlike OCI), so this
 * provisions IaaS infrastructure — the actual Oracle software install onto
 * the VM is a separate follow-up step, not yet wired up here.
 */
export function createAzureVmAction(options: { config: Config }) {
  const { config } = options;

  return createTemplateAction({
    id: 'oracle:azure:createVm',
    description: 'Provisions an Oracle DB VM on Azure',
    schema: {
      input: {
        dbName: z => z.string().describe('Database name'),
        oracleVersion: z => z.string().describe('Oracle database version'),
        vmSize: z => z.string().describe('Azure VM size'),
        licenseModel: z =>
          z.enum(['BYOL', 'PAYG']).describe('License model'),
        adminPassword: z =>
          z.string().describe('Admin password for the VM/database'),
      },
      output: {
        vmId: z => z.string(),
        consoleUrl: z => z.string(),
      },
    },
    async handler(ctx) {
      const { dbName, oracleVersion, vmSize, licenseModel, adminPassword } =
        ctx.input;

      const subscriptionId = config.getString(
        'oracleDbaas.azure.subscriptionId',
      );
      const tenantId = config.getString('oracleDbaas.azure.tenantId');
      const clientId = config.getString('oracleDbaas.azure.clientId');
      const clientSecret = config.getString('oracleDbaas.azure.clientSecret');
      const resourceGroup = config.getString(
        'oracleDbaas.azure.resourceGroup',
      );
      const location = config.getString('oracleDbaas.azure.location');
      const subnetId = config.getString('oracleDbaas.azure.subnetId');
      const imagePublisher = config.getString(
        'oracleDbaas.azure.image.publisher',
      );
      const imageOffer = config.getString('oracleDbaas.azure.image.offer');
      const imageSku =
        config.getOptionalString(
          `oracleDbaas.azure.image.skus.${oracleVersion}`,
        ) ?? config.getString('oracleDbaas.azure.image.defaultSku');
      const adminUsername =
        config.getOptionalString('oracleDbaas.azure.adminUsername') ??
        'oracleadmin';

      const credential = new ClientSecretCredential(
        tenantId,
        clientId,
        clientSecret,
      );
      const networkClient = new NetworkManagementClient(
        credential,
        subscriptionId,
      );
      const computeClient = new ComputeManagementClient(
        credential,
        subscriptionId,
      );

      const nicName = `${dbName}-nic`;
      ctx.logger.info(`Creating network interface ${nicName}`);
      const nic = await networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
        resourceGroup,
        nicName,
        {
          location,
          ipConfigurations: [
            {
              name: `${dbName}-ipconfig`,
              subnet: { id: subnetId },
            },
          ],
        },
      );

      ctx.logger.info(
        `Launching Azure VM "${dbName}" (${vmSize}, Oracle ${oracleVersion}, ${licenseModel})`,
      );
      const vm = await computeClient.virtualMachines.beginCreateOrUpdateAndWait(
        resourceGroup,
        dbName,
        {
          location,
          hardwareProfile: { vmSize },
          storageProfile: {
            imageReference: {
              publisher: imagePublisher,
              offer: imageOffer,
              sku: imageSku,
              version: 'latest',
            },
          },
          osProfile: {
            computerName: dbName,
            adminUsername,
            adminPassword,
          },
          networkProfile: {
            networkInterfaces: [{ id: nic.id, primary: true }],
          },
          tags: {
            oracleVersion,
            licenseModel,
            managedBy: 'polaris-prime-dbaas',
          },
        },
      );

      const consoleUrl = `https://portal.azure.com/#@${tenantId}/resource${vm.id}/overview`;

      ctx.logger.info(`Azure VM created: ${vm.id}`);
      ctx.output('vmId', vm.id ?? '');
      ctx.output('consoleUrl', consoleUrl);
    },
  });
}
