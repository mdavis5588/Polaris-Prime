import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createOciDbSystemAction } from './actions/oci';
import { createAzureVmAction } from './actions/azure';
import { createOnPremRequestAction } from './actions/onprem';
import { createUnsupportedProductAction } from './actions/unsupportedProduct';

export const oracleDbaasModule = createBackendModule({
  moduleId: 'oracle-dbaas',
  pluginId: 'scaffolder',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolderActions: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolderActions, config }) {
        scaffolderActions.addActions(
          createOciDbSystemAction({ config }),
          createAzureVmAction({ config }),
          createOnPremRequestAction(),
          createUnsupportedProductAction(),
        );
      },
    });
  },
});

// backend.add(import('./modules/oracleDbaas/module')) only picks up a
// default export — without this, the dynamic import resolves to a plain
// object with no $$type and backend.add() rejects it.
export default oracleDbaasModule;
