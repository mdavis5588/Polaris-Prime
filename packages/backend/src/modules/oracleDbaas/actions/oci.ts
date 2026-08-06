import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import type { Config } from '@backstage/config';
import * as common from 'oci-common';
import * as database from 'oci-database';

/**
 * Provisions an Oracle DB System on OCI using the values selected in the
 * oracle-dbaas template plus platform-level networking/auth config that
 * end users never see (compartment, subnet, AD, service credentials).
 */
export function createOciDbSystemAction(options: { config: Config }) {
  const { config } = options;

  return createTemplateAction({
    id: 'oracle:oci:createDbSystem',
    description: 'Provisions an Oracle DB System on OCI',
    schema: {
      input: {
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
      const { dbName, oracleVersion, shape, licenseModel, adminPassword } =
        ctx.input;

      const region = config.getString('oracleDbaas.oci.region');
      const tenancy = config.getString('oracleDbaas.oci.tenancyOcid');
      const user = config.getString('oracleDbaas.oci.userOcid');
      const fingerprint = config.getString('oracleDbaas.oci.fingerprint');
      const privateKey = config.getString('oracleDbaas.oci.privateKey');
      const passphrase = config.getOptionalString(
        'oracleDbaas.oci.passphrase',
      );
      const compartmentId = config.getString('oracleDbaas.oci.compartmentId');
      const availabilityDomain = config.getString(
        'oracleDbaas.oci.availabilityDomain',
      );
      const subnetId = config.getString('oracleDbaas.oci.subnetId');
      const sshPublicKey = config.getString('oracleDbaas.oci.sshPublicKey');

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
        `Launching OCI DB System "${dbName}" (${shape}, Oracle ${oracleVersion}, ${licenseModel})`,
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
