/**
 * Resource group external ids are stored as full ARM resource ids
 * (/subscriptions/.../resourceGroups/<name>), and NSG/deployment external
 * ids as full ARM resource ids one level deeper. Parsing the name back
 * out of the id avoids needing to separately track "which resource group
 * is this in" once we already have its ARM id.
 */
export function resourceGroupNameFromId(id: string): string {
  const parts = id.split('/');
  const idx = parts.findIndex(p => p.toLowerCase() === 'resourcegroups');
  const name = idx >= 0 ? parts[idx + 1] : undefined;
  if (!name) {
    throw new Error(`Could not parse resource group name from id: ${id}`);
  }
  return name;
}

export function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1];
}
