"use client";

import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function Input({ label, id, error, className = '', inputRef, ...props }: InputProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        ref={inputRef}
        className={`w-full rounded-xl border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:ring-4 ${
          error ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:border-amber focus:ring-amber/20'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
