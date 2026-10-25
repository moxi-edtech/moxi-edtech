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
      className={`w-full rounded-xl border bg-card p-3 text-sm text-foreground outline-none transition-colors focus:ring-4 ${
        error ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:border-amber focus:ring-amber/20'
      } ${className}`}
      {...props}
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

  if (!label) return selectEl;

  return (
    <div className="w-full">
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {selectEl}
      {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
