import React, { useEffect, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

interface ClientOption {
  code: string;
  name: string;
  tenants: { id: string; name: string; target: string }[];
}

interface TenantPickerUiOptions {
  /** Which cloud this branch represents — set via ui:options in the
   * template, since this field lives inside the oci/azure oneOf branch. */
  target?: 'oci' | 'azure';
}

/**
 * Lets the user pick which of the selected client's tenants to deploy
 * into, scoped to this branch's cloud (oci/azure) — e.g. a client with
 * both a dev OCI tenancy and a production Azure subscription only sees
 * the OCI one here when target is oci. Fetches the same sanitized list
 * ClientPickerField does; the actual tenancy credentials never leave the
 * backend.
 */
export const TenantPickerField = ({
  onChange,
  formData,
  formContext,
  uiSchema,
}: FieldExtensionComponentProps<string, TenantPickerUiOptions>) => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const uiOptions = (uiSchema?.['ui:options'] ?? {}) as TenantPickerUiOptions;
  const target = uiOptions.target;

  const allAnswers =
    (formContext as { formData?: Record<string, any> } | undefined)
      ?.formData ?? {};
  const clientCode = allAnswers?.client as string | undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('dbaas-tenants');
        const res = await fetchApi.fetch(`${baseUrl}/clients`);
        const data = res.ok ? ((await res.json()) as ClientOption[]) : [];
        if (!cancelled) setClients(data);
      } catch {
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi]);

  const client = clients.find(c => c.code === clientCode);
  const tenants = (client?.tenants ?? []).filter(t => t.target === target);

  // If the client changed and the previously picked tenant no longer
  // belongs to it, clear the stale selection.
  useEffect(() => {
    if (formData && !tenants.some(t => t.id === formData)) {
      onChange(undefined as unknown as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientCode]);

  const boxStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '1rem 1.25rem',
    marginBottom: '1.25rem',
    background: 'rgba(139, 92, 246, 0.06)',
  };

  if (loading) {
    return <div style={boxStyle}>Loading tenants…</div>;
  }

  if (!clientCode) {
    return (
      <div style={{ ...boxStyle, color: '#64748b', fontSize: '0.85rem' }}>
        Select a Client first to see its available tenants.
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div style={{ ...boxStyle, color: '#64748b', fontSize: '0.85rem' }}>
        {client?.name ?? clientCode} has no {target?.toUpperCase()} tenants
        configured.
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Tenant</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(tenants.length, 3)}, 1fr)`,
          gap: '0.75rem',
        }}
      >
        {tenants.map(tenant => {
          const selected = formData === tenant.id;
          return (
            <label
              key={tenant.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '0.75rem 0.5rem',
                borderRadius: 8,
                border: `1px solid ${selected ? '#7c3aed' : '#e2e8f0'}`,
                background: selected ? '#8b5cf6' : '#ffffff',
                color: selected ? '#ffffff' : 'inherit',
                fontWeight: selected ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="tenantId"
                value={tenant.id}
                checked={selected}
                onChange={() => onChange(tenant.id)}
                style={{ display: 'none' }}
              />
              {tenant.name}
            </label>
          );
        })}
      </div>
    </div>
  );
};
