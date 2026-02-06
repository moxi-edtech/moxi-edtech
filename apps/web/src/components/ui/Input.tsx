"use client";

import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function Input({ label, id, error, className = '', inputRef, ...props }: InputProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <div className="w-full">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        className={`w-full p-3 border rounded-lg transition-colors duration-200 ${
          error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
