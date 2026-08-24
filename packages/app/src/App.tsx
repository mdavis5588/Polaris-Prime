import { createApp } from '@backstage/frontend-defaults';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { UnifiedThemeProvider } from '@backstage/theme';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { authModule } from './modules/auth';
import { polarisPrimeTheme } from './theme/polarisPrime';
import { dbaasPlugin } from './plugins/dbaas/plugin';
import { networkingPlugin } from './plugins/networking/plugin';
import { dashboardPlugin } from './plugins/dashboard/plugin';
import { finOpsPlugin } from './plugins/finops/plugin';

const polarisPrimeThemeExtension = ThemeBlueprint.make({
  name: 'polaris-prime',
  params: {
    theme: {
      id: 'polaris-prime',
      title: 'Polaris Prime',
      variant: 'light',
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={polarisPrimeTheme} children={children} />
      ),
    },
  },
});

const themeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [polarisPrimeThemeExtension],
});

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    themeModule,
    authModule,
    dbaasPlugin,
    networkingPlugin,
    dashboardPlugin,
    finOpsPlugin,
  ],
});
