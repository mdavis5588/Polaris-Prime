import {
  createBaseThemeOptions,
  createUnifiedTheme,
  palettes,
} from '@backstage/theme';

export const polarisPrimeTheme = createUnifiedTheme({
  ...createBaseThemeOptions({
    palette: {
      ...palettes.light,
      primary: { main: '#7c3aed' },
      secondary: { main: '#8b5cf6' },
      navigation: {
        background: '#2b2438',
        indicator: '#8b5cf6',
        color: '#b3acc0',
        selectedColor: '#ffffff',
        navItem: {
          hoverBackground: 'rgba(255,255,255,.08)',
        },
      },
      background: {
        default: '#f4f6f8',
        paper: '#ffffff',
      },
    },
  }),
});
