import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import DashboardIcon from '@material-ui/icons/Dashboard';

const dashboardPage = PageBlueprint.make({
  params: {
    path: '/dashboard',
    title: 'Dashboard',
    icon: <DashboardIcon />,
    loader: () => import('./DashboardPage').then(m => <m.DashboardPage />),
  },
});

export const dashboardPlugin = createFrontendPlugin({
  pluginId: 'dashboard',
  extensions: [dashboardPage],
});

export default dashboardPlugin;
