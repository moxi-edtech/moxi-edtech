import * as React from 'react';
import type { SelectHTMLAttributes, ReactNode } from 'react';
import { fieldControlClass, fieldErrorClass, fieldFocusClass, fieldLabelClass } from './fieldStyles';

type Option = { value: string; label: string };
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options?: Option[];
};

export function Select({ label, id, error, className = '', options, children, ...props }: Props) {
  const reactId = React.useId();
  const selectId = id ?? reactId;
  const errorId = `${selectId}-error`;
  const describedBy = [props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const selectEl = (
    <select
      id={selectId}
      {...props}
      aria-invalid={error ? true : props["aria-invalid"]}
      aria-describedby={describedBy}
      className={`${fieldControlClass} ${error ? fieldErrorClass : fieldFocusClass} ${className}`}
    >
      {options && options.length > 0
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-card text-foreground">
              {opt.label}
            </option>
          ))
        : (children as ReactNode)}
    </select>
  );

  if (!label && !error) return selectEl;

  if (!label) return <div className="w-full">{selectEl}{error && <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}</div>;

  return (
    <div className="w-full">
      <label htmlFor={selectId} className={fieldLabelClass}>{label}</label>
      {selectEl}
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
