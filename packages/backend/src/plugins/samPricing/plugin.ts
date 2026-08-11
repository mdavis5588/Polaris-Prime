import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { createRouter } from './router';

export const samPricingPlugin = createBackendPlugin({
  pluginId: 'sam-pricing',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        httpRouter.use(await createRouter({ config, logger }));
      },
    });
  },
});

// backend.add(import('./plugins/samPricing/plugin')) only picks up a
// default export.
export default samPricingPlugin;
