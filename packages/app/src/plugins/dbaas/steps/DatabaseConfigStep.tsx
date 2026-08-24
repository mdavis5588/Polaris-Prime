import TextField from '@material-ui/core/TextField';
import { StepShell } from '../components/StepShell';
import type { DbaasWizardState } from '../types';

interface DatabaseConfigStepProps {
  form: DbaasWizardState;
  onChange: (fields: Partial<DbaasWizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,7}$/;

export const DatabaseConfigStep = ({ form, onChange, onNext, onBack }: DatabaseConfigStepProps) => {
  const nameValid = NAME_PATTERN.test(form.dbName);
  const canProceed = nameValid && form.dbAdminPassword.length > 0;

  return (
    <StepShell title="Database Configuration" onNext={onNext} onBack={onBack} nextDisabled={!canProceed}>
      <TextField
        label="Database Name"
        value={form.dbName}
        onChange={e => onChange({ dbName: e.target.value })}
        error={form.dbName.length > 0 && !nameValid}
        helperText="1-8 characters, must start with a letter, letters and numbers only"
        fullWidth
        margin="normal"
        variant="outlined"
      />
      <TextField
        label="Admin Password"
        type="password"
        value={form.dbAdminPassword}
        onChange={e => onChange({ dbAdminPassword: e.target.value })}
        fullWidth
        margin="normal"
        variant="outlined"
      />
    </StepShell>
  );
};
