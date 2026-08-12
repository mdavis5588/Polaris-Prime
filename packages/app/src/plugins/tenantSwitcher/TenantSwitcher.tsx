import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import { useTenant, tenantKey } from './TenantContext';

/**
 * Lets the signed-in user flip between the tenants their Azure AD groups
 * give them access to. Renders nothing for guest users or users with no
 * tenant access (an empty list from /tenants/mine) — the on-prem/Azure
 * hybrid deployment feature this exists for isn't reachable without it.
 */
export const TenantSwitcher = () => {
  const { tenants, loading, currentTenant, setCurrentTenant } = useTenant();

  if (loading || tenants.length === 0) {
    return null;
  }

  return (
    <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
      <Select
        value={currentTenant ? tenantKey(currentTenant) : ''}
        onChange={e => setCurrentTenant(e.target.value as string)}
        fullWidth
        variant="outlined"
        style={{ background: '#ffffff', borderRadius: 8, fontSize: '0.85rem' }}
      >
        {tenants.map(t => (
          <MenuItem key={tenantKey(t)} value={tenantKey(t)}>
            {t.name}
          </MenuItem>
        ))}
      </Select>
    </div>
  );
};
