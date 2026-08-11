import React, { useEffect } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface InfoNoteUiOptions {
  message?: string;
}

/**
 * A read-only informational box with no real input — used to fill the
 * Hosting Decision page for Self-Supported deployments, since Backstage
 * can't skip a whole wizard page based on a previous answer. Auto-fills
 * its own (unused) form value so it never blocks step validation.
 */
export const InfoNoteField = ({
  onChange,
  formData,
  uiSchema,
}: FieldExtensionComponentProps<string, InfoNoteUiOptions>) => {
  const uiOptions = (uiSchema?.['ui:options'] ?? {}) as InfoNoteUiOptions;

  useEffect(() => {
    if (formData === undefined) {
      onChange('acknowledged');
    }
  }, [formData, onChange]);

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        color: '#64748b',
        fontSize: '0.9rem',
      }}
    >
      {uiOptions.message ?? 'Not applicable.'}
    </div>
  );
};
