import {
  coreServices,
  createBackendPlugin,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { NetworkingStore } from './store';

const migrationsDir = resolvePackagePath('backend', 'migrations', 'networking');

export const networkingPlugin = createBackendPlugin({
  pluginId: 'networking',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        userInfo: coreServices.userInfo,
        config: coreServices.rootConfig,
        database: coreServices.database,
      },
      async init({ httpRouter, httpAuth, userInfo, config, database }) {
        const client = await database.getClient();
        if (!database.migrations?.skip) {
          await client.migrate.latest({ directory: migrationsDir });
        }
        const store = new NetworkingStore(client);
        httpRouter.use(await createRouter({ config, httpAuth, userInfo, store }));
      },
    });
  },
});

// backend.add(import('./plugins/networking/plugin')) only picks up a default export.
export default networkingPlugin;
