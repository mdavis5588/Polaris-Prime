import React, { useEffect } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

const FULLY_MANAGED_ONPREM_TIER: Record<string, string> = {
  oracle: 'Oracle Exadata',
  sqlserver: 'SQL Server',
  mongodb: 'MongoDB',
  postgresql: 'PostgreSQL',
};

const TARGET_OPTIONS = [
  { value: 'onprem', label: 'On-Premises' },
  { value: 'oci', label: 'Oracle Cloud (OCI)' },
  { value: 'azure', label: 'Microsoft Azure' },
];

/**
 * Renders the "Where do you want to deploy?" choice. Reads
 * formContext.formData directly (the full accumulated answers across all
 * wizard pages, not just this step) to check whether Data Sovereignty
 * Requirement was answered "yes" on the Hosting Decision page — if so,
 * deployment is forced to on-prem only and the normal cloud options are
 * hidden entirely, since data sovereignty rules out OCI/Azure regardless
 * of anything picked later.
 */
export const DeploymentTargetField = ({
  onChange,
  formData,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const allAnswers =
    (formContext as { formData?: Record<string, any> } | undefined)
      ?.formData ?? {};
  const dataSovereigntyRequired =
    allAnswers?.dataSovereignty?.hasDataSovereigntyRequirement === 'yes';
  const dbProduct = allAnswers?.dbProduct as string | undefined;
  const supportModel = allAnswers?.supportModel as string | undefined;

  useEffect(() => {
    if (dataSovereigntyRequired && formData !== 'onprem') {
      onChange('onprem');
    }
  }, [dataSovereigntyRequired, formData, onChange]);

  const boxStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '1rem 1.25rem',
    marginBottom: '1.25rem',
    background: 'rgba(139, 92, 246, 0.06)',
  };

  if (dataSovereigntyRequired) {
    // No choice to present at all — on-prem is the only option, so don't
    // render a "Where do you want to deploy?" chooser. Just a plain note
    // explaining why, no box/styling implying a decision was made here.
    const tierName = dbProduct ? FULLY_MANAGED_ONPREM_TIER[dbProduct] : undefined;
    return (
      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
        Deploying On-Premises — required because Data Sovereignty Requirement
        was answered "Yes."
        {supportModel === 'fully-managed' && tierName && (
          <>
            {' '}
            Fully Managed On-Prem: <strong>{tierName}</strong>.
          </>
        )}
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
        Where do you want to deploy?
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${TARGET_OPTIONS.length}, 1fr)`,
          gap: '0.75rem',
        }}
      >
        {TARGET_OPTIONS.map(option => {
          const selected = formData === option.value;
          return (
            <label
              key={option.value}
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
                name="deploymentTarget"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                style={{ display: 'none' }}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
};
