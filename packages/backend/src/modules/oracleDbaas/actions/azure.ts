import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import type { Config } from '@backstage/config';
import { ClientSecretCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { NetworkManagementClient } from '@azure/arm-network';
import { resolveTenantConfig } from '../resolveTenant';

/**
 * Provisions an Oracle-ready VM on Azure sized per the selection in the
 * oracle-dbaas template, resolving the actual subscription/network/auth
 * config server-side from the selected client + tenant — end users only
 * ever pick a tenant by name, never see the underlying IDs/credentials.
 * The marketplace image reference (which OS/DB image to boot) is shared
 * platform config, not tenant-specific.
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
        clientCode: z => z.string().describe('Client code'),
        tenantId: z => z.string().describe('Azure tenant id for this client'),
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
      const {
        clientCode,
        tenantId,
        dbName,
        oracleVersion,
        vmSize,
        licenseModel,
        adminPassword,
      } = ctx.input;

      const tenantConfig = resolveTenantConfig(config, clientCode, tenantId, 'azure');

      const subscriptionId = tenantConfig.getString('subscriptionId');
      const azureTenantId = tenantConfig.getString('tenantId');
      const clientId = tenantConfig.getString('clientId');
      const clientSecret = tenantConfig.getString('clientSecret');
      const resourceGroup = tenantConfig.getString('resourceGroup');
      const location = tenantConfig.getString('location');
      const subnetId = tenantConfig.getString('subnetId');
      const adminUsername =
        tenantConfig.getOptionalString('adminUsername') ?? 'oracleadmin';

      const imagePublisher = config.getString('oracleDbaas.azureImage.publisher');
      const imageOffer = config.getString('oracleDbaas.azureImage.offer');
      const imageSku =
        config.getOptionalString(`oracleDbaas.azureImage.skus.${oracleVersion}`) ??
        config.getString('oracleDbaas.azureImage.defaultSku');

      const credential = new ClientSecretCredential(
        azureTenantId,
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
        `Launching Azure VM "${dbName}" for ${clientCode}/${tenantId} (${vmSize}, Oracle ${oracleVersion}, ${licenseModel})`,
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

      const consoleUrl = `https://portal.azure.com/#@${azureTenantId}/resource${vm.id}/overview`;

      ctx.logger.info(`Azure VM created: ${vm.id}`);
      ctx.output('vmId', vm.id ?? '');
      ctx.output('consoleUrl', consoleUrl);
    },
  });
}
