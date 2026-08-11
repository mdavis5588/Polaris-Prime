import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { createRouter } from './router';

export const dbaasTenantsPlugin = createBackendPlugin({
  pluginId: 'dbaas-tenants',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, config }) {
        httpRouter.use(await createRouter({ config }));
      },
    });
  },
});

// backend.add(import('./plugins/dbaasTenants/plugin')) only picks up a
// default export.
export default dbaasTenantsPlugin;
