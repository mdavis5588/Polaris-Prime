import React from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface BoxedChoiceUiOptions {
  boxTitle?: string;
  /** Number of grid columns the options are arranged into. Defaults to
   * one row (columns = number of options). */
  columns?: number;
}

/**
 * Renders an enum field as a bordered, rounded "box" with a title header,
 * containing the options as individually selectable boxes arranged in a
 * CSS grid — used for the Support Model / Database Product sections in
 * the DBaaS template. Built from plain radio inputs rather than a design
 * system component so the grid layout (e.g. 2 columns) is fully reliable.
 */
export const BoxedChoiceField = ({
  onChange,
  required,
  schema,
  uiSchema,
  rawErrors,
  formData,
  idSchema,
}: FieldExtensionComponentProps<string, BoxedChoiceUiOptions>) => {
  const options = (schema.enum ?? []) as string[];
  const enumNames = ((schema as { enumNames?: string[] }).enumNames ??
    options) as string[];
  const uiOptions = (uiSchema?.['ui:options'] ?? {}) as BoxedChoiceUiOptions;
  const boxTitle = uiOptions.boxTitle ?? schema.title;
  const columns = uiOptions.columns ?? options.length;
  const hasError = (rawErrors?.length ?? 0) > 0;

  return (
    <div
      style={{
        border: `1px solid ${hasError ? '#dc2626' : '#e2e8f0'}`,
        borderRadius: 10,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
      }}
    >
      {boxTitle && (
        <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
          {boxTitle}
          {required && <span style={{ color: '#dc2626' }}> *</span>}
        </div>
      )}
      <div
        role="radiogroup"
        aria-required={required}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '0.75rem',
        }}
      >
        {options.map((option, i) => {
          const selected = formData === option;
          return (
            <label
              key={option}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '0.75rem 0.5rem',
                borderRadius: 8,
                border: `1px solid ${selected ? '#7c3aed' : '#e2e8f0'}`,
                background: selected ? 'rgba(139,92,246,0.08)' : 'transparent',
                fontWeight: selected ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name={idSchema.$id}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                style={{ display: 'none' }}
              />
              {enumNames[i] ?? option}
            </label>
          );
        })}
      </div>
    </div>
  );
};
