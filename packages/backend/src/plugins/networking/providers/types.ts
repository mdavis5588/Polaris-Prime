export interface RuleSpec {
  name: string;
  priority: number;
  direction: 'inbound' | 'outbound';
  access: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | '*';
  sourceAddressPrefix: string;
  sourcePortRange: string;
  destinationAddressPrefix: string;
  destinationPortRange: string;
}

/**
 * Canonical Resource Group / NSG operations Polaris exposes the same way
 * regardless of deployment target — the Azure provider maps these
 * directly onto real ARM/Network resources, and the on-prem provider
 * (once the orchestrator's API contract exists — see
 * docs/orchestrator-api-contract.md) would translate them into whatever
 * the orchestrator's own networking primitives are.
 */
export interface NetworkProvider {
  createResourceGroup(input: { name: string }): Promise<{ externalId: string }>;
  deleteResourceGroup(input: { externalId: string }): Promise<void>;
  createNsg(input: {
    resourceGroupExternalId: string;
    name: string;
  }): Promise<{ externalId: string }>;
  deleteNsg(input: { externalId: string }): Promise<void>;
  addRule(input: { nsgExternalId: string; rule: RuleSpec }): Promise<void>;
  removeRule(input: { nsgExternalId: string; ruleName: string }): Promise<void>;
}
