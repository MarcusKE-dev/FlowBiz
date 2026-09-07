// src/components/ui/FormField.jsx
//
// Label, control, and the two things a field has to be able to say:
// what it wants (hint) and what went wrong (error). The error is wired
// to the control with aria-describedby and aria-invalid so it is
// announced, not just coloured.

import { useId } from 'react';

export default function FormField({
  label,
  hint,
  error,
  required = false,
  children,
  htmlFor,
  className = '',
}) {
  const generated = useId();
  const id = htmlFor || generated;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {typeof children === 'function'
        ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
        : children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-secondary text-danger-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-secondary text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
