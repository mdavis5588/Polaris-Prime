import { createApp } from '@backstage/frontend-defaults';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { UnifiedThemeProvider } from '@backstage/theme';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { polarisPrimeTheme } from './theme/polarisPrime';

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
  features: [catalogPlugin, navModule, themeModule],
});
