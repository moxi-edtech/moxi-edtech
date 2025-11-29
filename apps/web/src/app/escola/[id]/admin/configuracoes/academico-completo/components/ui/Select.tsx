import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

type Option = { value: string; label: string };
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options?: Option[];
};

export function Select({ label, id, error, className = '', options, children, ...props }: Props) {
  const fallbackId = useId();
  const selectId = id || fallbackId;
  const selectEl = (
    <select
      id={selectId}
      className={`w-full p-3 border rounded-lg transition-colors ${
        error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
      } ${className}`}
      {...props}
    >
      {options && options.length > 0
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );

  if (!label) return selectEl;

  return (
    <div className="w-full">
      <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {selectEl}
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
