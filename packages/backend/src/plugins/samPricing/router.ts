import Router from 'express-promise-router';
import express from 'express';
import { Client } from 'pg';
import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';

/**
 * Serves current Oracle price list rows read directly from Helios/SAM-tool's
 * shared.oracle_product_list_prices table (read-only), so Polaris's cost
 * comparison reflects the org's actual imported/negotiated Oracle prices
 * instead of only public list prices.
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

  router.get('/oracle-list-prices', async (_req, res) => {
    const samConfig = config.getOptionalConfig('samTool.database');
    if (!samConfig) {
      res.status(503).json({ error: 'samTool.database is not configured' });
      return;
    }

    const client = new Client({
      host: samConfig.getString('host'),
      port: samConfig.getNumber('port'),
      database: samConfig.getString('database'),
      user: samConfig.getString('user'),
      password: samConfig.getString('password'),
      ssl: samConfig.getOptionalBoolean('ssl')
        ? { rejectUnauthorized: false }
        : undefined,
    });

    try {
      await client.connect();
      const result = await client.query(
        `SELECT product_name, metric, list_price
         FROM shared.oracle_product_list_prices
         WHERE is_current = true`,
      );
      res.json(
        result.rows.map(row => ({
          productName: row.product_name as string,
          metric: row.metric as string,
          listPrice: Number(row.list_price),
        })),
      );
    } catch (err) {
      logger.warn(`Failed to query SAM-tool pricing data: ${err}`);
      res.status(502).json({ error: 'Failed to query SAM-tool database' });
    } finally {
      await client.end().catch(() => {});
    }
  });

  return router;
}
