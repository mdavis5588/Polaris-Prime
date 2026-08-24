import type { DeploymentProvider } from './deploymentTypes';

const NOT_IMPLEMENTED =
  'On-prem service deployment is not yet implemented — pending the ' +
  'orchestrator API contract (see docs/orchestrator-api-contract.md). ' +
  'This request was logged for manual follow-up.';

export function createOnPremDeploymentProvider(): DeploymentProvider {
  return {
    async createDeployment() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async deleteDeployment() {
      throw new Error(NOT_IMPLEMENTED);
    },
  };
}
