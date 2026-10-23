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
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        ref={inputRef}
        className={`w-full p-3 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground transition-colors duration-200 ${
          error
            ? 'border-destructive focus:ring-destructive focus:border-destructive'
            : 'border-input focus:ring-ring focus:border-ring'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}
