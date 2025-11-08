import React from 'react';

type Variant = 'success' | 'neutral' | 'outline' | 'error';

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

export function Badge({ children, variant = 'neutral', className = '' }: Props) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
  const variants: Record<Variant, string> = {
    success: 'bg-green-100 text-green-800',
    neutral: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-300 text-gray-700 bg-white',
    error: 'bg-red-100 text-red-800',
  };
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>;
}
