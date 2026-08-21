import type { Knex } from 'knex';
import { randomUUID } from 'crypto';
import type { RuleSpec } from './providers/types';

export interface ResourceGroupRecord {
  id: string;
  tenant_key: string;
  target: 'azure' | 'onprem';
  name: string;
  description: string | null;
  external_id: string | null;
  status: 'pending' | 'active' | 'failed' | 'deleting';
  error: string | null;
  created_at: string;
}

export interface NsgRecord {
  id: string;
  resource_group_id: string;
  name: string;
  external_id: string | null;
  status: 'pending' | 'active' | 'failed' | 'deleting';
  error: string | null;
  created_at: string;
}

export interface NsgRuleRecord {
  id: string;
  nsg_id: string;
  name: string;
  priority: number;
  direction: 'inbound' | 'outbound';
  access: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | '*';
  source_address_prefix: string;
  source_port_range: string;
  destination_address_prefix: string;
  destination_port_range: string;
  status: 'pending' | 'active' | 'failed' | 'deleting';
  error: string | null;
  created_at: string;
}

const tenantKey = (clientCode: string, tenantId: string) => `${clientCode}:${tenantId}`;

export class NetworkingStore {
  constructor(private readonly db: Knex) {}

  // --- Resource groups ---

  async listResourceGroups(clientCode: string, tenantId: string): Promise<ResourceGroupRecord[]> {
    return this.db<ResourceGroupRecord>('resource_groups')
      .where({ tenant_key: tenantKey(clientCode, tenantId) })
      .orderBy('created_at', 'asc');
  }

  async getResourceGroup(id: string): Promise<ResourceGroupRecord | undefined> {
    return this.db<ResourceGroupRecord>('resource_groups').where({ id }).first();
  }

  async createResourceGroup(input: {
    clientCode: string;
    tenantId: string;
    target: 'azure' | 'onprem';
    name: string;
    description?: string;
  }): Promise<string> {
    const id = randomUUID();
    await this.db('resource_groups').insert({
      id,
      tenant_key: tenantKey(input.clientCode, input.tenantId),
      target: input.target,
      name: input.name,
      description: input.description ?? null,
      status: 'pending',
    });
    return id;
  }

  async markResourceGroupResult(
    id: string,
    result: { status: 'active' | 'failed'; externalId?: string; error?: string },
  ): Promise<void> {
    await this.db('resource_groups')
      .where({ id })
      .update({
        status: result.status,
        external_id: result.externalId ?? null,
        error: result.error ?? null,
      });
  }

  async deleteResourceGroup(id: string): Promise<void> {
    await this.db('resource_groups').where({ id }).delete();
  }

  // --- NSGs ---

  async listNsgs(resourceGroupId: string): Promise<NsgRecord[]> {
    return this.db<NsgRecord>('network_security_groups')
      .where({ resource_group_id: resourceGroupId })
      .orderBy('created_at', 'asc');
  }

  async getNsg(id: string): Promise<NsgRecord | undefined> {
    return this.db<NsgRecord>('network_security_groups').where({ id }).first();
  }

  async createNsg(input: { resourceGroupId: string; name: string }): Promise<string> {
    const id = randomUUID();
    await this.db('network_security_groups').insert({
      id,
      resource_group_id: input.resourceGroupId,
      name: input.name,
      status: 'pending',
    });
    return id;
  }

  async markNsgResult(
    id: string,
    result: { status: 'active' | 'failed'; externalId?: string; error?: string },
  ): Promise<void> {
    await this.db('network_security_groups')
      .where({ id })
      .update({
        status: result.status,
        external_id: result.externalId ?? null,
        error: result.error ?? null,
      });
  }

  async deleteNsg(id: string): Promise<void> {
    await this.db('network_security_groups').where({ id }).delete();
  }

  // --- Rules ---

  async listRules(nsgId: string): Promise<NsgRuleRecord[]> {
    return this.db<NsgRuleRecord>('nsg_rules').where({ nsg_id: nsgId }).orderBy('priority', 'asc');
  }

  async getRule(id: string): Promise<NsgRuleRecord | undefined> {
    return this.db<NsgRuleRecord>('nsg_rules').where({ id }).first();
  }

  async createRule(input: { nsgId: string; rule: RuleSpec }): Promise<string> {
    const id = randomUUID();
    await this.db('nsg_rules').insert({
      id,
      nsg_id: input.nsgId,
      name: input.rule.name,
      priority: input.rule.priority,
      direction: input.rule.direction,
      access: input.rule.access,
      protocol: input.rule.protocol,
      source_address_prefix: input.rule.sourceAddressPrefix,
      source_port_range: input.rule.sourcePortRange,
      destination_address_prefix: input.rule.destinationAddressPrefix,
      destination_port_range: input.rule.destinationPortRange,
      status: 'pending',
    });
    return id;
  }

  async markRuleResult(
    id: string,
    result: { status: 'active' | 'failed'; error?: string },
  ): Promise<void> {
    await this.db('nsg_rules')
      .where({ id })
      .update({ status: result.status, error: result.error ?? null });
  }

  async deleteRule(id: string): Promise<void> {
    await this.db('nsg_rules').where({ id }).delete();
  }
}
