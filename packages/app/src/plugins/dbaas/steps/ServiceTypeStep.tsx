import { useEffect, useState } from 'react';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { BoxedChoice } from '../components/BoxedChoice';
import { Note } from '../components/Note';
import { StepShell } from '../components/StepShell';
import { fetchClients, ClientOption } from '../api';
import { DB_VERSIONS, DbaasWizardState, DbProduct, SupportModel } from '../types';

interface ServiceTypeStepProps {
  form: DbaasWizardState;
  onChange: (fields: Partial<DbaasWizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Client and Tenant are asked together here, once — Tenant is a
 * client-scoped cost-attribution tag, not tied to a cloud account, so it
 * applies no matter what's picked later on Deployment Target.
 */
export const ServiceTypeStep = ({ form, onChange, onNext, onBack }: ServiceTypeStepProps) => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchClients(discoveryApi, fetchApi);
      if (!cancelled) {
        setClients(data);
        setLoadingClients(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi]);

  const selectedClient = clients.find(c => c.code === form.client);
  const tenantOptions = (selectedClient?.tenants ?? []).map(t => ({ value: t.id, label: t.name }));

  const canProceed = Boolean(
    form.client && form.tenant && form.supportModel && form.dbProduct && form.dbVersion,
  );

  return (
    <StepShell title="Service Type" onNext={onNext} onBack={onBack} nextDisabled={!canProceed}>
      {loadingClients ? (
        <Note>Loading clients…</Note>
      ) : clients.length === 0 ? (
        <Note>No clients are configured yet (oracleDbaas.clients in app-config.yaml is empty).</Note>
      ) : (
        <BoxedChoice
          title="Client"
          columns={Math.min(clients.length, 3)}
          required
          options={clients.map(c => ({ value: c.code, label: c.name }))}
          value={form.client}
          onChange={code => onChange({ client: code, tenant: null })}
        />
      )}

      {form.client && (
        tenantOptions.length === 0 ? (
          <Note>{selectedClient?.name ?? form.client} has no tenants configured.</Note>
        ) : (
          <BoxedChoice
            title="Tenant"
            subtitle="Used to track and attribute cost for this deployment. Applies regardless of where it's deployed."
            columns={Math.min(tenantOptions.length, 3)}
            required
            options={tenantOptions}
            value={form.tenant}
            onChange={tenant => onChange({ tenant })}
          />
        )
      )}

      <BoxedChoice
        title="Support Model"
        columns={2}
        required
        options={[
          { value: 'fully-managed', label: 'Fully Managed Service' },
          { value: 'self-supported', label: 'Self-Supported' },
        ]}
        value={form.supportModel}
        onChange={v => onChange({ supportModel: v as SupportModel })}
      />

      <BoxedChoice
        title="Database Product"
        columns={2}
        required
        options={[
          { value: 'oracle', label: 'Oracle' },
          { value: 'sqlserver', label: 'SQL Server' },
          { value: 'mongodb', label: 'MongoDB' },
          { value: 'postgresql', label: 'PostgreSQL' },
        ]}
        value={form.dbProduct}
        onChange={v => onChange({ dbProduct: v as DbProduct, dbVersion: null })}
      />

      {form.dbProduct && (
        <BoxedChoice
          title="Version"
          columns={2}
          required
          options={DB_VERSIONS[form.dbProduct]}
          value={form.dbVersion}
          onChange={v => onChange({ dbVersion: v })}
        />
      )}
    </StepShell>
  );
};
