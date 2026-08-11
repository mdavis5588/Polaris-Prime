import React from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { RadioGroup, Radio } from '@backstage/ui';

interface BoxedChoiceUiOptions {
  boxTitle?: string;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Renders an enum field as a bordered, rounded "box" containing a radio
 * choice — used to visually separate the Support Model / Database Product
 * sections in the DBaaS template instead of a plain flat list of fields.
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
  const orientation = uiOptions.orientation ?? 'vertical';

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
      }}
    >
      {boxTitle && (
        <div style={{ fontWeight: 600, marginBottom: '0.65rem' }}>
          {boxTitle}
        </div>
      )}
      <RadioGroup
        name={idSchema.$id}
        value={formData ?? ''}
        onChange={value => onChange(value)}
        orientation={orientation}
        isRequired={required}
        isInvalid={(rawErrors?.length ?? 0) > 0}
      >
        {options.map((option, i) => (
          <Radio key={option} value={option}>
            {enumNames[i] ?? option}
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
};
