import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';
import * as common from 'oci-common';
import * as database from 'oci-database';
import { resolveClientCloudConfig, resolveTenantTagName } from '../resolveClientCloudConfig';

export interface LaunchOciDbSystemInput {
  clientCode: string;
  tenantTag: string;
  dbName: string;
  oracleVersion: string;
  shape: string;
  licenseModel: 'BYOL' | 'LICENSE_INCLUDED';
  adminPassword: string;
}

export interface LaunchOciDbSystemResult {
  dbSystemId: string;
  consoleUrl: string;
}

/**
 * Provisions an Oracle DB System on OCI, resolving the actual
 * tenancy/network/auth config server-side from the selected client — end
 * users never see the underlying OCIDs/credentials. The tenant tag is a
 * tracking/cost-attribution label only; it plays no part in credential
 * resolution and is applied to the created DB System as a freeform tag.
 */
export async function launchOciDbSystem(
  config: Config,
  input: LaunchOciDbSystemInput,
  logger: LoggerService,
): Promise<LaunchOciDbSystemResult> {
  const { clientCode, tenantTag, dbName, oracleVersion, shape, licenseModel, adminPassword } = input;

  const cloudConfig = resolveClientCloudConfig(config, clientCode, 'oci');
  const tenantTagName = resolveTenantTagName(config, clientCode, tenantTag);

  const region = cloudConfig.getString('region');
  const tenancy = cloudConfig.getString('tenancyOcid');
  const user = cloudConfig.getString('userOcid');
  const fingerprint = cloudConfig.getString('fingerprint');
  const privateKey = cloudConfig.getString('privateKey');
  const passphrase = cloudConfig.getOptionalString('passphrase');
  const compartmentId = cloudConfig.getString('compartmentId');
  const availabilityDomain = cloudConfig.getString('availabilityDomain');
  const subnetId = cloudConfig.getString('subnetId');
  const sshPublicKey = cloudConfig.getString('sshPublicKey');

  const provider = new common.SimpleAuthenticationDetailsProvider(
    tenancy,
    user,
    fingerprint,
    privateKey,
    passphrase ?? null,
    common.Region.fromRegionId(region),
  );

  const client = new database.DatabaseClient({
    authenticationDetailsProvider: provider,
  });

  logger.info(
    `Launching OCI DB System "${dbName}" for ${clientCode} (tenant tag: ${tenantTagName}, ${shape}, Oracle ${oracleVersion}, ${licenseModel})`,
  );

  const response = await client.launchDbSystem({
    launchDbSystemDetails: {
      compartmentId,
      availabilityDomain,
      subnetId,
      shape,
      sshPublicKeys: [sshPublicKey],
      hostname: dbName,
      licenseModel: licenseModel as database.models.LaunchDbSystemBase.LicenseModel,
      initialDataStorageSizeInGB: 256,
      dbSystemOptions: {
        storageManagement: database.models.DbSystemOptions.StorageManagement.Lvm,
      },
      dbHome: {
        dbVersion: oracleVersion,
        database: {
          dbName: dbName.substring(0, 8),
          adminPassword,
        },
      },
      freeformTags: {
        'polaris-prime-client': clientCode,
        'polaris-prime-tenant': tenantTag,
      },
    } as database.models.LaunchDbSystemDetails,
  });

  const dbSystemId = response.dbSystem.id;
  const consoleUrl = `https://cloud.oracle.com/dbaas/dbSystems/${dbSystemId}?region=${region}`;

  logger.info(`OCI DB System launch initiated: ${dbSystemId}`);

  return { dbSystemId, consoleUrl };
}
