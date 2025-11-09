import React from 'react';

type Variant = 'success' | 'neutral' | 'outline' | 'error' | 'default';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
  variant?: Variant;
};

export function Badge({ children, variant = 'neutral', className = '', ...rest }: Props) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
  const variants: Record<Variant, string> = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    neutral: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-300 text-gray-700 bg-white',
    error: 'bg-red-100 text-red-800',
  };
  return <span className={`${base} ${variants[variant]} ${className}`} {...rest}>{children}</span>;
}
