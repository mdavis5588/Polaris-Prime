import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

/**
 * Placeholder for database products other than Oracle. PostgreSQL, SQL
 * Server, and MongoDB are exposed in the template for discoverability, but
 * only Oracle provisioning (OCI/Azure/on-prem) is actually automated so
 * far — this intentionally throws rather than pretending to provision
 * anything.
 */
export function createUnsupportedProductAction() {
  return createTemplateAction({
    id: 'dbaas:unsupportedProduct:requestProvision',
    description:
      'Placeholder for database products that are not yet automated',
    schema: {
      input: {
        dbName: z => z.string(),
        dbProduct: z => z.string(),
        dbVersion: z => z.string(),
        target: z => z.string(),
      },
    },
    async handler(ctx) {
      const { dbName, dbProduct, dbVersion, target } = ctx.input;
      ctx.logger.info(
        `Requested: ${dbName}, ${dbProduct} ${dbVersion} on ${target}`,
      );
      throw new Error(
        `Provisioning for ${dbProduct} is not yet automated — only Oracle is currently supported. This request was logged for manual follow-up.`,
      );
    },
  });
}
