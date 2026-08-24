import { Page, Header, Content } from '@backstage/core-components';
import Typography from '@material-ui/core/Typography';

/**
 * Placeholder — the real version should give an at-a-glance overview of
 * the signed-in user's tenants, resource groups, and deployments.
 */
export const DashboardPage = () => (
  <Page themeId="home">
    <Header
      title="Dashboard"
      subtitle="Overview of your tenants, resource groups, and deployments"
    />
    <Content>
      <Typography color="textSecondary">Coming soon.</Typography>
    </Content>
  </Page>
);
