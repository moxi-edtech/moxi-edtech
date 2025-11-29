"use client";

import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, id, error, className = '', ...props }: TextareaProps) {
  const fallbackId = useId();
  const textareaId = id || fallbackId;

  const textareaEl = (
    <textarea
      id={textareaId}
      className={`w-full p-3 border rounded-lg transition-colors duration-200 ${
        error
          ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
      } ${className}`}
      {...props}
    />
  );

  if (!label) return textareaEl;

  return (
    <div className="w-full">
      <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      {textareaEl}
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
