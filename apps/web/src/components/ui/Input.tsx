"use client";

import * as React from 'react';
import type { InputHTMLAttributes, Ref } from 'react';
import { fieldControlClass, fieldErrorClass, fieldFocusClass, fieldLabelClass } from './fieldStyles';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function Input({ label, id, error, className = '', inputRef, ...props }: InputProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const errorId = `${inputId}-error`;
  const describedBy = [props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className={fieldLabelClass}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        ref={inputRef}
        {...props}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        className={`${fieldControlClass} ${error ? fieldErrorClass : fieldFocusClass} ${className}`}
      />
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
