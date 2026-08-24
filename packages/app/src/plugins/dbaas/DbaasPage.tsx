import { useState } from 'react';
import { Page, Header, Content } from '@backstage/core-components';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { HostingDecisionStep } from './steps/HostingDecisionStep';
import { ServiceTypeStep } from './steps/ServiceTypeStep';
import { DatabaseConfigStep } from './steps/DatabaseConfigStep';
import { DeploymentTargetStep } from './steps/DeploymentTargetStep';
import { ResultStep } from './steps/ResultStep';
import { submitProvisioning, ProvisionResult } from './api';
import { DbaasWizardState, initialWizardState, SovereigntyAnswer } from './types';

type StepId = 'hosting' | 'service' | 'config' | 'deploy';

/**
 * The Database as a Service self-service wizard — a plain plugin page
 * instead of a scaffolder template. Each step is an ordinary React
 * component reading/writing a single piece of local state, and submission
 * calls the dbaas backend plugin's /provision route directly, rather than
 * going through scaffolder actions/steps.
 */
export const DbaasPage = () => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [step, setStep] = useState<StepId>('hosting');
  const [form, setForm] = useState<DbaasWizardState>(initialWizardState);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const patch = (fields: Partial<DbaasWizardState>) =>
    setForm(prev => ({ ...prev, ...fields }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitProvisioning(discoveryApi, fetchApi, form);
      if (!res.ok) {
        setSubmitError(res.error ?? 'Provisioning failed.');
      } else {
        setResult(res);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestart = () => {
    setForm(initialWizardState);
    setResult(null);
    setSubmitError(null);
    setStep('hosting');
  };

  return (
    <Page themeId="tool">
      <Header
        title="Database as a Service"
        subtitle="Self-service provisioning for Oracle, SQL Server, MongoDB, and PostgreSQL"
      />
      <Content>
        {result ? (
          <ResultStep result={result} onRestart={handleRestart} />
        ) : (
          <>
            {step === 'hosting' && (
              <HostingDecisionStep
                value={form.dataSovereignty}
                onChange={(v: SovereigntyAnswer) => patch({ dataSovereignty: v })}
                onNext={() => setStep('service')}
              />
            )}
            {step === 'service' && (
              <ServiceTypeStep
                form={form}
                onChange={patch}
                onNext={() => setStep('config')}
                onBack={() => setStep('hosting')}
              />
            )}
            {step === 'config' && (
              <DatabaseConfigStep
                form={form}
                onChange={patch}
                onNext={() => setStep('deploy')}
                onBack={() => setStep('service')}
              />
            )}
            {step === 'deploy' && (
              <DeploymentTargetStep
                form={form}
                onChange={patch}
                onSubmit={handleSubmit}
                onBack={() => setStep('config')}
                submitting={submitting}
                error={submitError}
              />
            )}
          </>
        )}
      </Content>
    </Page>
  );
};
