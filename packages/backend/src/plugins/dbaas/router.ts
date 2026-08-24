import Router from 'express-promise-router';
import express from 'express';
import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';
import { launchOciDbSystem } from './provision/oci';
import { launchAzureVm } from './provision/azure';

interface ProvisionRequestBody {
  client: string;
  tenant: string;
  dbProduct: string;
  dbVersion: string;
  dbName: string;
  dbAdminPassword: string;
  desiredCpuCores: number;
  memoryGb: number;
  desiredStorageGb: number;
  target: 'onprem' | 'oci' | 'azure';
  licenseModel?: string;
  ociShape?: string;
  azureVmSize?: string;
}

/**
 * Handles submissions from the DBaaS wizard page — the direct replacement
 * for what used to be the oracle-dbaas scaffolder template's steps and
 * actions. Only Oracle provisioning on OCI/Azure is actually automated;
 * everything else responds with automated: false and logs the request for
 * manual follow-up, same behavior as the old placeholder actions had.
 */
export async function createRouter({
  config,
  logger,
}: {
  config: Config;
  logger: LoggerService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  router.post('/provision', async (req, res) => {
    const body = req.body as ProvisionRequestBody;

    if (body.dbProduct !== 'oracle') {
      logger.info(
        `Requested: ${body.dbName}, ${body.dbProduct} ${body.dbVersion} on ${body.target} (not yet automated)`,
      );
      res.json({
        ok: true,
        automated: false,
        message: `Provisioning for ${body.dbProduct} is not yet automated — only Oracle is currently supported. This request was logged for manual follow-up.`,
      });
      return;
    }

    if (body.target === 'onprem') {
      logger.info(
        `Requested: ${body.dbName} for ${body.client} (tenant tag: ${body.tenant}), Oracle ${body.dbVersion}, ` +
          `${body.desiredCpuCores} vCPU / ${body.memoryGb}GB RAM / ${body.desiredStorageGb}GB storage`,
      );
      res.json({
        ok: true,
        automated: false,
        message:
          'On-prem provisioning is not yet implemented — pending the orchestrator API auth decision (OIDC vs. LDAP-bind token). This request was logged for manual follow-up.',
      });
      return;
    }

    try {
      if (body.target === 'oci') {
        const result = await launchOciDbSystem(
          config,
          {
            clientCode: body.client,
            tenantTag: body.tenant,
            dbName: body.dbName,
            oracleVersion: body.dbVersion,
            shape: body.ociShape ?? '',
            licenseModel: body.licenseModel as 'BYOL' | 'LICENSE_INCLUDED',
            adminPassword: body.dbAdminPassword,
          },
          logger,
        );
        res.json({ ok: true, automated: true, ...result });
        return;
      }

      if (body.target === 'azure') {
        const result = await launchAzureVm(
          config,
          {
            clientCode: body.client,
            tenantTag: body.tenant,
            dbName: body.dbName,
            oracleVersion: body.dbVersion,
            vmSize: body.azureVmSize ?? '',
            licenseModel: body.licenseModel as 'BYOL' | 'PAYG',
            adminPassword: body.dbAdminPassword,
          },
          logger,
        );
        res.json({ ok: true, automated: true, ...result });
        return;
      }

      res.status(400).json({ ok: false, error: `Unknown deployment target: ${body.target}` });
    } catch (err) {
      logger.error(`DBaaS provisioning failed: ${err}`);
      res.status(502).json({
        ok: false,
        automated: true,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
