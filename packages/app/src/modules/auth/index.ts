import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { microsoftAuthApi } from './microsoftAuthApi';
import { signInPage } from './SignInPage';
import { tenantRootWrapper } from './rootWrapper';

export const authModule = createFrontendModule({
  pluginId: 'app',
  extensions: [microsoftAuthApi, signInPage, tenantRootWrapper],
});

export default authModule;
