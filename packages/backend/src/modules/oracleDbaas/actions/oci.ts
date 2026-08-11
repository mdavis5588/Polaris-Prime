import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import type { Config } from '@backstage/config';
import * as common from 'oci-common';
import * as database from 'oci-database';
import { resolveTenantConfig } from '../resolveTenant';

/**
 * Provisions an Oracle DB System on OCI using the values selected in the
 * oracle-dbaas template, resolving the actual tenancy/network/auth config
 * server-side from the selected client + tenant — end users only ever
 * pick a tenant by name, never see the underlying OCIDs/credentials.
 */
export function createOciDbSystemAction(options: { config: Config }) {
  const { config } = options;

  return createTemplateAction({
    id: 'oracle:oci:createDbSystem',
    description: 'Provisions an Oracle DB System on OCI',
    schema: {
      input: {
        clientCode: z => z.string().describe('Client code'),
        tenantId: z => z.string().describe('OCI tenant id for this client'),
        dbName: z => z.string().describe('Database name'),
        oracleVersion: z => z.string().describe('Oracle database version'),
        shape: z => z.string().describe('OCI DB System shape'),
        licenseModel: z =>
          z.enum(['BYOL', 'LICENSE_INCLUDED']).describe('License model'),
        adminPassword: z =>
          z.string().describe('Admin password for the database'),
      },
      output: {
        dbSystemId: z => z.string(),
        consoleUrl: z => z.string(),
      },
    },
    async handler(ctx) {
      const {
        clientCode,
        tenantId,
        dbName,
        oracleVersion,
        shape,
        licenseModel,
        adminPassword,
      } = ctx.input;

      const tenantConfig = resolveTenantConfig(config, clientCode, tenantId, 'oci');

      const region = tenantConfig.getString('region');
      const tenancy = tenantConfig.getString('tenancyOcid');
      const user = tenantConfig.getString('userOcid');
      const fingerprint = tenantConfig.getString('fingerprint');
      const privateKey = tenantConfig.getString('privateKey');
      const passphrase = tenantConfig.getOptionalString('passphrase');
      const compartmentId = tenantConfig.getString('compartmentId');
      const availabilityDomain = tenantConfig.getString('availabilityDomain');
      const subnetId = tenantConfig.getString('subnetId');
      const sshPublicKey = tenantConfig.getString('sshPublicKey');

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

      ctx.logger.info(
        `Launching OCI DB System "${dbName}" for ${clientCode}/${tenantId} (${shape}, Oracle ${oracleVersion}, ${licenseModel})`,
      );

      const response = await client.launchDbSystem({
        launchDbSystemDetails: {
          compartmentId,
          availabilityDomain,
          subnetId,
          shape,
          sshPublicKeys: [sshPublicKey],
          hostname: dbName,
          licenseModel:
            licenseModel as database.models.LaunchDbSystemBase.LicenseModel,
          initialDataStorageSizeInGB: 256,
          dbSystemOptions: {
            storageManagement: database.models.DbSystemOptions
              .StorageManagement.Lvm,
          },
          dbHome: {
            dbVersion: oracleVersion,
            database: {
              dbName: dbName.substring(0, 8),
              adminPassword,
            },
          },
        } as database.models.LaunchDbSystemDetails,
      });

      const dbSystemId = response.dbSystem.id;
      const consoleUrl = `https://cloud.oracle.com/dbaas/dbSystems/${dbSystemId}?region=${region}`;

      ctx.logger.info(`OCI DB System launch initiated: ${dbSystemId}`);

      ctx.output('dbSystemId', dbSystemId);
      ctx.output('consoleUrl', consoleUrl);
    },
  });
}
