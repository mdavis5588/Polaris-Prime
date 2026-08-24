import type { Config } from '@backstage/config';
import type { RuleSpec } from './types';

export interface NetBoxSettings {
  baseUrl: string;
  apiToken: string;
  vlanGroupId: number;
  vlanIdRangeStart: number;
  vlanIdRangeEnd: number;
  parentPrefixId: number;
  prefixLength: number;
}

export function readNetBoxSettings(netboxConfig: Config): NetBoxSettings {
  return {
    baseUrl: netboxConfig.getString('baseUrl').replace(/\/+$/, ''),
    apiToken: netboxConfig.getString('apiToken'),
    vlanGroupId: netboxConfig.getNumber('vlanGroupId'),
    vlanIdRangeStart: netboxConfig.getOptionalNumber('vlanIdRangeStart') ?? 100,
    vlanIdRangeEnd: netboxConfig.getOptionalNumber('vlanIdRangeEnd') ?? 999,
    parentPrefixId: netboxConfig.getNumber('parentPrefixId'),
    prefixLength: netboxConfig.getOptionalNumber('prefixLength') ?? 24,
  };
}

async function netboxRequest<T>(
  settings: NetBoxSettings,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${settings.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${settings.apiToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`NetBox request failed (${res.status} ${path}): ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * NetBox has no built-in "next available VLAN ID" endpoint (unlike
 * prefixes, which do), so this lists what's already used in the
 * configured group and picks the lowest free id in the configured range.
 * Good enough for this volume of VLAN creation; races between concurrent
 * requests aren't handled (NetBox will reject a duplicate vid with a 400,
 * which surfaces as a request failure rather than silently colliding).
 */
async function nextAvailableVid(settings: NetBoxSettings): Promise<number> {
  const data = await netboxRequest<{ results: { vid: number }[] }>(
    settings,
    `/api/ipam/vlans/?group_id=${settings.vlanGroupId}&limit=0`,
  );
  const used = new Set(data.results.map(v => v.vid));
  for (let vid = settings.vlanIdRangeStart; vid <= settings.vlanIdRangeEnd; vid += 1) {
    if (!used.has(vid)) return vid;
  }
  throw new Error(
    `No free VLAN id in range ${settings.vlanIdRangeStart}-${settings.vlanIdRangeEnd}`,
  );
}

export interface NetBoxVlan {
  id: number;
  vid: number;
}

export async function createVlan(
  settings: NetBoxSettings,
  input: { name: string; siteId?: number },
): Promise<NetBoxVlan> {
  const vid = await nextAvailableVid(settings);
  return netboxRequest<NetBoxVlan>(settings, '/api/ipam/vlans/', {
    method: 'POST',
    body: JSON.stringify({
      vid,
      name: input.name,
      group: settings.vlanGroupId,
      site: input.siteId,
      status: 'active',
    }),
  });
}

export async function deleteVlan(settings: NetBoxSettings, vlanId: number): Promise<void> {
  await netboxRequest(settings, `/api/ipam/vlans/${vlanId}/`, { method: 'DELETE' });
}

export interface NetBoxPrefix {
  id: number;
  prefix: string;
}

/**
 * Carves the next available /prefixLength subnet out of the configured
 * parent prefix/aggregate — a real, stable NetBox core feature — then
 * attaches it to the given VLAN.
 */
export async function allocatePrefixForVlan(
  settings: NetBoxSettings,
  vlanId: number,
): Promise<NetBoxPrefix> {
  const [carved] = await netboxRequest<NetBoxPrefix[]>(
    settings,
    `/api/ipam/prefixes/${settings.parentPrefixId}/available-prefixes/`,
    {
      method: 'POST',
      body: JSON.stringify([{ prefix_length: settings.prefixLength }]),
    },
  );
  return netboxRequest<NetBoxPrefix>(settings, `/api/ipam/prefixes/${carved.id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ vlan: vlanId }),
  });
}

export async function deletePrefix(settings: NetBoxSettings, prefixId: number): Promise<void> {
  await netboxRequest(settings, `/api/ipam/prefixes/${prefixId}/`, { method: 'DELETE' });
}

// --- Access Lists (NSG equivalent), via the community netbox-acls plugin ---
//
// IMPORTANT: netbox-acls is a third-party plugin, not NetBox core — its
// exact field names can vary by version and aren't something this
// session can verify against a live instance the way the Azure SDK types
// were. The shapes below match the plugin's documented API as of its
// stable releases; if your NetBox instance rejects a field name here,
// check GET /api/plugins/access-lists/ (or its Swagger/OpenAPI schema at
// /api/schema/) against what's below and adjust.

export interface NetBoxAccessList {
  id: number;
}

export async function createAccessList(
  settings: NetBoxSettings,
  input: { name: string; vlanId: number },
): Promise<NetBoxAccessList> {
  return netboxRequest<NetBoxAccessList>(settings, '/api/plugins/access-lists/access-lists/', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      assigned_object_type: 'ipam.vlan',
      assigned_object_id: input.vlanId,
      type: 'extended',
      default_action: 'deny',
    }),
  });
}

export async function deleteAccessList(settings: NetBoxSettings, id: number): Promise<void> {
  await netboxRequest(settings, `/api/plugins/access-lists/access-lists/${id}/`, {
    method: 'DELETE',
  });
}

const PROTOCOL_MAP: Record<RuleSpec['protocol'], string> = {
  tcp: 'tcp',
  udp: 'udp',
  '*': '', // netbox-acls omits protocol to mean "any"
};

export interface NetBoxAccessListRule {
  id: number;
}

export async function createAccessListRule(
  settings: NetBoxSettings,
  input: { accessListId: number; rule: RuleSpec },
): Promise<NetBoxAccessListRule> {
  return netboxRequest<NetBoxAccessListRule>(
    settings,
    '/api/plugins/access-lists/access-list-rules/',
    {
      method: 'POST',
      body: JSON.stringify({
        access_list: input.accessListId,
        index: input.rule.priority,
        description: input.rule.name,
        action: input.rule.access === 'allow' ? 'permit' : 'deny',
        protocol: PROTOCOL_MAP[input.rule.protocol] || undefined,
        source_prefix: input.rule.sourceAddressPrefix === '*' ? undefined : input.rule.sourceAddressPrefix,
        source_ports:
          input.rule.sourcePortRange === '*' ? undefined : [input.rule.sourcePortRange],
        destination_prefix:
          input.rule.destinationAddressPrefix === '*'
            ? undefined
            : input.rule.destinationAddressPrefix,
        destination_ports:
          input.rule.destinationPortRange === '*'
            ? undefined
            : [input.rule.destinationPortRange],
      }),
    },
  );
}

/**
 * netbox-acls rules aren't addressed by name, so removing one by name (to
 * match how the Azure side works, and how NetworkProvider.removeRule is
 * shaped) means finding it first by its description field, which
 * createAccessListRule above sets to the rule's name.
 */
export async function deleteAccessListRuleByName(
  settings: NetBoxSettings,
  accessListId: number,
  ruleName: string,
): Promise<void> {
  const data = await netboxRequest<{ results: { id: number; description?: string }[] }>(
    settings,
    `/api/plugins/access-lists/access-list-rules/?access_list_id=${accessListId}&limit=0`,
  );
  const match = data.results.find(r => r.description === ruleName);
  if (!match) {
    throw new Error(`No access list rule named "${ruleName}" found on access list ${accessListId}`);
  }
  await netboxRequest(settings, `/api/plugins/access-lists/access-list-rules/${match.id}/`, {
    method: 'DELETE',
  });
}
