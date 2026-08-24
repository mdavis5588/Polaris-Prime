import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { createRouter } from './router';

export const tenantsPlugin = createBackendPlugin({
  pluginId: 'tenants',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        userInfo: coreServices.userInfo,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, httpAuth, userInfo, config }) {
        httpRouter.use(await createRouter({ config, httpAuth, userInfo }));
      },
    });
  },
});

// backend.add(import('./plugins/tenants/plugin')) only picks up a default export.
export default tenantsPlugin;
