import { Page, Header, Content } from '@backstage/core-components';
import Typography from '@material-ui/core/Typography';

/**
 * Placeholder — the real version should extend the cost-estimation logic
 * already built for the DBaaS wizard's CostComparison component into a
 * broader view: estimated/actual spend across all of a tenant's resource
 * groups and deployments.
 */
export const FinOpsPage = () => (
  <Page themeId="home">
    <Header title="FinOps" subtitle="Cost tracking across your resource groups and deployments" />
    <Content>
      <Typography color="textSecondary">Coming soon.</Typography>
    </Content>
  </Page>
);
