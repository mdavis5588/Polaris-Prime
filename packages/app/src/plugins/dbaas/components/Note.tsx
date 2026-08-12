import React from 'react';

/** A quiet, read-only informational box — no border emphasis, just muted text. */
export const Note = ({ children }: { children: React.ReactNode }) => (
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
    {children}
  </div>
);

/** A plain (unboxed) muted note — used where a box would wrongly imply a choice was made. */
export const PlainNote = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
    {children}
  </div>
);

export const ErrorNote = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      border: '1px solid #dc2626',
      borderRadius: 10,
      padding: '1rem 1.25rem',
      marginBottom: '1.25rem',
      color: '#dc2626',
      fontSize: '0.9rem',
      background: 'rgba(220, 38, 38, 0.06)',
    }}
  >
    {children}
  </div>
);
