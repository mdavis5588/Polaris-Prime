import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';
import { ClientSecretCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { NetworkManagementClient } from '@azure/arm-network';
import { resolveClientCloudConfig, resolveTenantTagName } from '../resolveClientCloudConfig';

export interface LaunchAzureVmInput {
  clientCode: string;
  tenantTag: string;
  dbName: string;
  oracleVersion: string;
  vmSize: string;
  licenseModel: 'BYOL' | 'PAYG';
  adminPassword: string;
}

export interface LaunchAzureVmResult {
  vmId: string;
  consoleUrl: string;
}

/**
 * Provisions an Oracle-ready VM on Azure, resolving the actual
 * subscription/network/auth config server-side from the selected client —
 * end users never see the underlying IDs/credentials. The tenant tag is a
 * tracking/cost-attribution label only; it plays no part in credential
 * resolution and is applied to the created VM as a resource tag. The
 * marketplace image reference (which OS/DB image to boot) is shared
 * platform config, not client-specific.
 *
 * Note: Azure has no native Oracle DBaaS offering (unlike OCI), so this
 * provisions IaaS infrastructure — the actual Oracle software install onto
 * the VM is a separate follow-up step, not yet wired up here.
 */
export async function launchAzureVm(
  config: Config,
  input: LaunchAzureVmInput,
  logger: LoggerService,
): Promise<LaunchAzureVmResult> {
  const { clientCode, tenantTag, dbName, oracleVersion, vmSize, licenseModel, adminPassword } = input;

  const cloudConfig = resolveClientCloudConfig(config, clientCode, 'azure');
  const tenantTagName = resolveTenantTagName(config, clientCode, tenantTag);

  const subscriptionId = cloudConfig.getString('subscriptionId');
  const azureTenantId = cloudConfig.getString('tenantId');
  const clientId = cloudConfig.getString('clientId');
  const clientSecret = cloudConfig.getString('clientSecret');
  const resourceGroup = cloudConfig.getString('resourceGroup');
  const location = cloudConfig.getString('location');
  const subnetId = cloudConfig.getString('subnetId');
  const adminUsername = cloudConfig.getOptionalString('adminUsername') ?? 'oracleadmin';

  const imagePublisher = config.getString('oracleDbaas.azureImage.publisher');
  const imageOffer = config.getString('oracleDbaas.azureImage.offer');
  const imageSku =
    config.getOptionalString(`oracleDbaas.azureImage.skus.${oracleVersion}`) ??
    config.getString('oracleDbaas.azureImage.defaultSku');

  const credential = new ClientSecretCredential(azureTenantId, clientId, clientSecret);
  const networkClient = new NetworkManagementClient(credential, subscriptionId);
  const computeClient = new ComputeManagementClient(credential, subscriptionId);

  const nicName = `${dbName}-nic`;
  logger.info(`Creating network interface ${nicName}`);
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

  logger.info(
    `Launching Azure VM "${dbName}" for ${clientCode} (tenant tag: ${tenantTagName}, ${vmSize}, Oracle ${oracleVersion}, ${licenseModel})`,
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
        'polaris-prime-client': clientCode,
        'polaris-prime-tenant': tenantTag,
      },
    },
  );

  const consoleUrl = `https://portal.azure.com/#@${azureTenantId}/resource${vm.id}/overview`;

  logger.info(`Azure VM created: ${vm.id}`);

  return { vmId: vm.id ?? '', consoleUrl };
}
