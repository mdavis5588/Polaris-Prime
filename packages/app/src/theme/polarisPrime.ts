import {
  createBaseThemeOptions,
  createUnifiedTheme,
  palettes,
} from '@backstage/theme';

const borderColor = '#e2e8f0';

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
        default: '#f8fafc',
        paper: '#ffffff',
      },
    },
  }),
  components: {
    // Rounded, lightly-bordered cards instead of heavy shadows — matches
    // Helios's flat card style (border + 10px radius, no drop shadow).
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: `1px solid ${borderColor}`,
        },
        elevation1: {
          boxShadow: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: `1px solid ${borderColor}`,
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 20,
        },
      },
    },
  },
});
