import { useEffect } from 'react';
import TextField from '@material-ui/core/TextField';
import { BoxedChoice } from '../components/BoxedChoice';
import { CostComparison } from '../components/CostComparison';
import { ErrorNote, PlainNote } from '../components/Note';
import { StepShell } from '../components/StepShell';
import { DbaasWizardState, DeploymentTarget, FULLY_MANAGED_ONPREM_TIER } from '../types';

interface DeploymentTargetStepProps {
  form: DbaasWizardState;
  onChange: (fields: Partial<DbaasWizardState>) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}

const TARGET_OPTIONS = [
  { value: 'onprem', label: 'On-Premises' },
  { value: 'oci', label: 'Oracle Cloud (OCI)' },
  { value: 'azure', label: 'Microsoft Azure' },
];

const OCI_SHAPE_OPTIONS = [
  { value: 'VM.Standard.E4.Flex.2.32', label: '2 OCPU / 32 GB' },
  { value: 'VM.Standard.E4.Flex.4.64', label: '4 OCPU / 64 GB' },
  { value: 'VM.Standard.E4.Flex.8.128', label: '8 OCPU / 128 GB' },
];

const AZURE_VM_SIZE_OPTIONS = [
  { value: 'Standard_E4s_v5', label: 'E4s v5 — 4 vCPU / 32 GB' },
  { value: 'Standard_E8s_v5', label: 'E8s v5 — 8 vCPU / 64 GB' },
  { value: 'Standard_E16s_v5', label: 'E16s v5 — 16 vCPU / 128 GB' },
  { value: 'Standard_M8ms', label: 'M8ms — 8 vCPU / 218 GB (memory-optimized)' },
];

/**
 * Reads formData.dataSovereignty directly, same as before: if Data
 * Sovereignty Requirement was answered "yes" on the Hosting Decision
 * step, deployment is forced to on-prem only and the target chooser
 * doesn't render at all — data sovereignty rules out OCI/Azure
 * regardless of anything picked later.
 */
export const DeploymentTargetStep = ({
  form,
  onChange,
  onSubmit,
  onBack,
  submitting,
  error,
}: DeploymentTargetStepProps) => {
  const dataSovereigntyRequired = form.dataSovereignty === 'yes';

  useEffect(() => {
    if (dataSovereigntyRequired && form.target !== 'onprem') {
      onChange({ target: 'onprem' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSovereigntyRequired]);

  const sizingComplete = Boolean(form.desiredCpuCores && form.memoryGb && form.desiredStorageGb);
  const targetDetailsComplete =
    form.target === 'onprem' ||
    (Boolean(form.licenseModel) &&
      (form.target === 'oci' ? Boolean(form.ociShape) : Boolean(form.azureVmSize)));
  const canSubmit = sizingComplete && Boolean(form.target) && targetDetailsComplete && !submitting;

  const tierName = form.dbProduct ? FULLY_MANAGED_ONPREM_TIER[form.dbProduct] : undefined;

  return (
    <StepShell
      title="Deployment Target"
      onNext={onSubmit}
      onBack={onBack}
      nextLabel={submitting ? 'Submitting…' : 'Submit'}
      nextDisabled={!canSubmit}
    >
      <TextField
        label="How many CPU cores do you need?"
        type="number"
        inputProps={{ min: 1 }}
        value={form.desiredCpuCores ?? ''}
        onChange={e => onChange({ desiredCpuCores: e.target.value === '' ? null : Number(e.target.value) })}
        fullWidth
        margin="normal"
        variant="outlined"
      />
      <TextField
        label="Memory (GB)"
        type="number"
        inputProps={{ min: 1 }}
        value={form.memoryGb ?? ''}
        onChange={e => onChange({ memoryGb: e.target.value === '' ? null : Number(e.target.value) })}
        fullWidth
        margin="normal"
        variant="outlined"
      />
      <TextField
        label="How much storage do you need (GB)?"
        type="number"
        inputProps={{ min: 10 }}
        value={form.desiredStorageGb ?? ''}
        onChange={e => onChange({ desiredStorageGb: e.target.value === '' ? null : Number(e.target.value) })}
        fullWidth
        margin="normal"
        variant="outlined"
        style={{ marginBottom: '1.25rem' }}
      />

      <CostComparison
        dbProduct={form.dbProduct}
        cpuCores={form.desiredCpuCores ?? 0}
        storageGb={form.desiredStorageGb ?? 0}
        dataSovereigntyRequired={dataSovereigntyRequired}
      />

      {dataSovereigntyRequired ? (
        <PlainNote>
          Deploying On-Premises — required because Data Sovereignty Requirement
          was answered "Yes."
          {form.supportModel === 'fully-managed' && tierName && (
            <>
              {' '}
              Fully Managed On-Prem: <strong>{tierName}</strong>.
            </>
          )}
        </PlainNote>
      ) : (
        <BoxedChoice
          title="Where do you want to deploy?"
          columns={TARGET_OPTIONS.length}
          required
          options={TARGET_OPTIONS}
          value={form.target}
          onChange={v => onChange({ target: v as DeploymentTarget })}
        />
      )}

      {form.target === 'oci' && (
        <>
          <BoxedChoice
            title="License Model"
            required
            options={[
              { value: 'BYOL', label: 'Bring Your Own License' },
              { value: 'LICENSE_INCLUDED', label: 'License Included (Subscription)' },
            ]}
            value={form.licenseModel}
            onChange={v => onChange({ licenseModel: v })}
          />
          <BoxedChoice
            title="DB System Shape"
            required
            options={OCI_SHAPE_OPTIONS}
            value={form.ociShape}
            onChange={v => onChange({ ociShape: v })}
          />
        </>
      )}

      {form.target === 'azure' && (
        <>
          <BoxedChoice
            title="License Model"
            required
            options={[
              { value: 'BYOL', label: 'Bring Your Own License' },
              { value: 'PAYG', label: 'Pay-As-You-Go (License Included)' },
            ]}
            value={form.licenseModel}
            onChange={v => onChange({ licenseModel: v })}
          />
          <BoxedChoice
            title="VM Size"
            required
            options={AZURE_VM_SIZE_OPTIONS}
            value={form.azureVmSize}
            onChange={v => onChange({ azureVmSize: v })}
          />
        </>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
    </StepShell>
  );
};
