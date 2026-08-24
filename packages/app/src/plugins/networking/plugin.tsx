import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet';

const networkingPage = PageBlueprint.make({
  params: {
    path: '/networking',
    title: 'Networking',
    icon: <SettingsEthernetIcon />,
    loader: () => import('./NetworkingPage').then(m => <m.NetworkingPage />),
  },
});

export const networkingPlugin = createFrontendPlugin({
  pluginId: 'networking',
  extensions: [networkingPage],
});

export default networkingPlugin;
