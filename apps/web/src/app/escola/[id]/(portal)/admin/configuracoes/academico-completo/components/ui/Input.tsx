"use client";

import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Componente de input com label e tratamento de erro.
 */
export function Input({ label, id, error, className, ...props }: InputProps) {
  const fallbackId = useId();
  const inputId = id || fallbackId;
  return (
    <div className="w-full">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full p-3 border rounded-lg transition-colors duration-200
          ${error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
          }
          ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
