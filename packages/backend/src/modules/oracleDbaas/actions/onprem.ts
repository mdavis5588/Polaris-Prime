import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

/**
 * Placeholder for on-prem provisioning via the internal orchestrator API.
 * Intentionally throws — wiring this up depends on how the orchestrator
 * issues its AD/LDAP-backed access token (OIDC federation vs. a proprietary
 * bind-and-mint token), which is still an open question. Accepts clientCode
 * + tenantTag now so the eventual orchestrator call can tag the on-prem
 * resource the same way OCI/Azure resources are tagged, keeping cost/
 * inventory tracking consistent across all three deployment targets.
 */
export function createOnPremRequestAction() {
  return createTemplateAction({
    id: 'oracle:onprem:requestProvision',
    description:
      'Placeholder for on-prem provisioning via the orchestrator API',
    schema: {
      input: {
        clientCode: z => z.string(),
        tenantTag: z =>
          z.string().describe('Tenant tracking tag id for this client'),
        dbName: z => z.string(),
        oracleVersion: z => z.string(),
        cpuCores: z => z.number(),
        memoryGb: z => z.number(),
        storageGb: z => z.number(),
      },
    },
    async handler(ctx) {
      ctx.logger.info(
        `Requested: ${ctx.input.dbName} for ${ctx.input.clientCode} (tenant tag: ${ctx.input.tenantTag}), ` +
          `Oracle ${ctx.input.oracleVersion}, ${ctx.input.cpuCores} vCPU / ${ctx.input.memoryGb}GB RAM / ${ctx.input.storageGb}GB storage`,
      );
      throw new Error(
        'On-prem provisioning is not yet implemented — pending the orchestrator API auth decision (OIDC vs. LDAP-bind token).',
      );
    },
  });
}
