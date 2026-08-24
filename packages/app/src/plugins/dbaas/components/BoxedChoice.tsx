export interface BoxedChoiceOption {
  value: string;
  label: string;
}

interface BoxedChoiceProps {
  title?: string;
  subtitle?: string;
  options: BoxedChoiceOption[];
  value?: string | null;
  onChange: (value: string) => void;
  columns?: number;
  required?: boolean;
  error?: boolean;
  name?: string;
}

/**
 * A bordered, rounded box containing selectable options arranged in a CSS
 * grid — the shared visual pattern behind every choice field in the DBaaS
 * wizard (support model, database product, client, tenant, deployment
 * target, license model, shapes/sizes). Plain radio inputs under the hood
 * so the grid layout stays reliable regardless of option count.
 */
export const BoxedChoice = ({
  title,
  subtitle,
  options,
  value,
  onChange,
  columns,
  required,
  error,
  name,
}: BoxedChoiceProps) => {
  const gridColumns = columns ?? options.length;
  const inputName = name ?? title ?? 'boxed-choice';

  return (
    <div
      style={{
        border: `1px solid ${error ? '#dc2626' : '#e2e8f0'}`,
        borderRadius: 10,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        background: 'rgba(139, 92, 246, 0.06)',
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, marginBottom: subtitle ? '0.25rem' : '0.75rem' }}>
          {title}
          {required && <span style={{ color: '#dc2626' }}> *</span>}
        </div>
      )}
      {subtitle && (
        <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {subtitle}
        </div>
      )}
      <div
        role="radiogroup"
        aria-required={required}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(gridColumns, 1)}, 1fr)`,
          gap: '0.75rem',
        }}
      >
        {options.map(option => {
          const selected = value === option.value;
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
                name={inputName}
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
