import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import AttachMoneyIcon from '@material-ui/icons/AttachMoney';

const finOpsPage = PageBlueprint.make({
  params: {
    path: '/finops',
    title: 'FinOps',
    icon: <AttachMoneyIcon />,
    loader: () => import('./FinOpsPage').then(m => <m.FinOpsPage />),
  },
});

export const finOpsPlugin = createFrontendPlugin({
  pluginId: 'finops',
  extensions: [finOpsPage],
});

export default finOpsPlugin;
