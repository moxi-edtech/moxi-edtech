import { useId } from 'react';
import type { SelectHTMLAttributes, ReactNode } from 'react';

type Option = { value: string; label: string };
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options?: Option[];
};

export function Select({ label, id, error, className = '', options, children, ...props }: Props) {
  const reactId = useId();
  const selectId = id ?? reactId;
  const selectEl = (
    <select
      id={selectId}
      className={`w-full p-3 border rounded-lg bg-background text-foreground transition-colors ${
        error
          ? 'border-destructive focus:ring-destructive focus:border-destructive'
          : 'border-input focus:ring-ring focus:border-ring'
      } ${className}`}
      {...props}
    >
      {options && options.length > 0
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : (children as ReactNode)}
    </select>
  );

  if (!label) return selectEl;

  return (
    <div className="w-full">
      <label htmlFor={selectId} className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {selectEl}
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}
