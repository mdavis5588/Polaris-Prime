import { BoxedChoice } from '../components/BoxedChoice';
import { StepShell } from '../components/StepShell';
import type { SovereigntyAnswer } from '../types';

interface HostingDecisionStepProps {
  value: SovereigntyAnswer | null;
  onChange: (value: SovereigntyAnswer) => void;
  onNext: () => void;
}

export const HostingDecisionStep = ({ value, onChange, onNext }: HostingDecisionStepProps) => (
  <StepShell title="Hosting Decision" onNext={onNext} nextDisabled={!value} showBack={false}>
    <BoxedChoice
      title="Do you have data sovereignty requirements?"
      columns={2}
      required
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
      value={value}
      onChange={v => onChange(v as SovereigntyAnswer)}
    />
  </StepShell>
);
