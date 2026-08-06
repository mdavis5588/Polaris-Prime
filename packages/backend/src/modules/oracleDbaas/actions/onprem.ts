import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

/**
 * Placeholder for on-prem provisioning via the internal orchestrator API.
 * Intentionally throws — wiring this up depends on how the orchestrator
 * issues its AD/LDAP-backed access token (OIDC federation vs. a proprietary
 * bind-and-mint token), which is still an open question.
 */
export function createOnPremRequestAction() {
  return createTemplateAction({
    id: 'oracle:onprem:requestProvision',
    description:
      'Placeholder for on-prem provisioning via the orchestrator API',
    schema: {
      input: {
        dbName: z => z.string(),
        oracleVersion: z => z.string(),
        cpuCores: z => z.number(),
        memoryGb: z => z.number(),
        storageGb: z => z.number(),
      },
    },
    async handler(ctx) {
      ctx.logger.info(
        `Requested: ${ctx.input.dbName}, Oracle ${ctx.input.oracleVersion}, ` +
          `${ctx.input.cpuCores} vCPU / ${ctx.input.memoryGb}GB RAM / ${ctx.input.storageGb}GB storage`,
      );
      throw new Error(
        'On-prem provisioning is not yet implemented — pending the orchestrator API auth decision (OIDC vs. LDAP-bind token).',
      );
    },
  });
}
