export interface DeploymentSpec {
  name: string;
  vmSize: string;
  adminUsername: string;
  adminPassword: string;
  /** ARM resource id of the NSG to attach to this deployment's network interface, if any. */
  nsgExternalId?: string;
}

export interface DeploymentResult {
  externalId: string;
  consoleUrl: string;
}

/**
 * Canonical "deploy a service into a resource group" operation — real for
 * Azure (an IaaS VM, same approach as the DBaaS Azure action), a stub for
 * on-prem pending the orchestrator API contract.
 */
export interface DeploymentProvider {
  createDeployment(input: {
    resourceGroupExternalId: string;
    spec: DeploymentSpec;
  }): Promise<DeploymentResult>;
  deleteDeployment(input: { resourceGroupExternalId: string; externalId: string }): Promise<void>;
}
