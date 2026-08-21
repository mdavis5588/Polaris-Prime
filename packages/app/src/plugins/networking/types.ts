export type ProvisionStatus = 'pending' | 'active' | 'failed' | 'deleting';
export type DeployTarget = 'azure' | 'onprem';

export interface ResourceGroup {
  id: string;
  tenant_key: string;
  target: DeployTarget;
  name: string;
  description: string | null;
  external_id: string | null;
  status: ProvisionStatus;
  error: string | null;
  created_at: string;
}

export interface Nsg {
  id: string;
  resource_group_id: string;
  name: string;
  external_id: string | null;
  status: ProvisionStatus;
  error: string | null;
  created_at: string;
}

export type Direction = 'inbound' | 'outbound';
export type Access = 'allow' | 'deny';
export type Protocol = 'tcp' | 'udp' | '*';

export interface NsgRule {
  id: string;
  nsg_id: string;
  name: string;
  priority: number;
  direction: Direction;
  access: Access;
  protocol: Protocol;
  source_address_prefix: string;
  source_port_range: string;
  destination_address_prefix: string;
  destination_port_range: string;
  status: ProvisionStatus;
  error: string | null;
  created_at: string;
}

export interface RuleInput {
  name: string;
  priority: number;
  direction: Direction;
  access: Access;
  protocol: Protocol;
  sourceAddressPrefix: string;
  sourcePortRange: string;
  destinationAddressPrefix: string;
  destinationPortRange: string;
}
