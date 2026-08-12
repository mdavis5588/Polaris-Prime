import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import StorageIcon from '@material-ui/icons/Storage';

const dbaasPage = PageBlueprint.make({
  params: {
    path: '/dbaas',
    title: 'Database as a Service',
    icon: <StorageIcon />,
    loader: () => import('./DbaasPage').then(m => <m.DbaasPage />),
  },
});

export const dbaasPlugin = createFrontendPlugin({
  pluginId: 'dbaas',
  extensions: [dbaasPage],
});

export default dbaasPlugin;
