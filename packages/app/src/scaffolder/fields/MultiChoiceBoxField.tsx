import React from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface MultiChoiceBoxUiOptions {
  boxTitle?: string;
}

interface SubQuestionSchema {
  title?: string;
  enum?: string[];
  enumNames?: string[];
}

/**
 * Renders an object field as one bordered box containing several yes/no
 * (or other short enum) sub-questions, each shown as a label with pill
 * toggle buttons on one row — used for Workload Consistency, which bundles
 * multiple related yes/no questions under a single heading rather than
 * being its own separate BoxedChoice per question.
 */
export const MultiChoiceBoxField = ({
  onChange,
  schema,
  uiSchema,
  formData,
}: FieldExtensionComponentProps<
  Record<string, string>,
  MultiChoiceBoxUiOptions
>) => {
  const uiOptions = (uiSchema?.['ui:options'] ?? {}) as MultiChoiceBoxUiOptions;
  const boxTitle = uiOptions.boxTitle ?? schema.title;
  const properties = (schema.properties ?? {}) as Record<
    string,
    SubQuestionSchema
  >;
  const data = formData ?? {};

  const setField = (key: string, value: string) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        background: 'rgba(139, 92, 246, 0.06)',
      }}
    >
      {boxTitle && (
        <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
          {boxTitle}
        </div>
      )}
      {Object.entries(properties).map(([key, sub]) => {
        const options = sub.enum ?? [];
        const names = sub.enumNames ?? options;
        const selectedValue = data[key];
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.5rem 0',
            }}
          >
            <span>{sub.title ?? key}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {options.map((option, i) => {
                const selected = selectedValue === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setField(key, option)}
                    style={{
                      padding: '0.35rem 0.9rem',
                      borderRadius: 8,
                      border: `1px solid ${selected ? '#7c3aed' : '#e2e8f0'}`,
                      background: selected ? '#8b5cf6' : '#ffffff',
                      color: selected ? '#ffffff' : 'inherit',
                      fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {names[i] ?? option}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
