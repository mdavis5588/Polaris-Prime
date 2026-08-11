import React, { useEffect, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

interface ClientOption {
  code: string;
  name: string;
  tenants: { id: string; name: string; target: string }[];
}

/**
 * Lets the user pick which client this database is for — fetches the
 * sanitized client list (names/codes only, no tenant credentials) from
 * the dbaas-tenants backend plugin, which reads the real
 * oracleDbaas.clients config server-side.
 */
export const ClientPickerField = ({
  onChange,
  formData,
}: FieldExtensionComponentProps<string>) => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

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

  const boxStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '1rem 1.25rem',
    marginBottom: '1.25rem',
    background: 'rgba(139, 92, 246, 0.06)',
  };

  if (loading) {
    return <div style={boxStyle}>Loading clients…</div>;
  }

  if (clients.length === 0) {
    return (
      <div style={{ ...boxStyle, color: '#64748b', fontSize: '0.85rem' }}>
        No clients are configured yet (oracleDbaas.clients in
        app-config.yaml is empty).
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Client</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(clients.length, 3)}, 1fr)`,
          gap: '0.75rem',
        }}
      >
        {clients.map(client => {
          const selected = formData === client.code;
          return (
            <label
              key={client.code}
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
                name="client"
                value={client.code}
                checked={selected}
                onChange={() => onChange(client.code)}
                style={{ display: 'none' }}
              />
              {client.name}
            </label>
          );
        })}
      </div>
    </div>
  );
};
