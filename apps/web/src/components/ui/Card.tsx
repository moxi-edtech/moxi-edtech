import React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode };

export function Card({ children, className = '', ...rest }: DivProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200/50 p-6 sm:p-8 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...rest }: DivProps) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...rest }: DivProps) {
  return (
    <div className={`mb-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...rest }: DivProps) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...rest }: DivProps) {
  return (
    <p className={`text-sm text-gray-600 mt-1 ${className}`} {...rest}>
      {children}
    </p>
  );
}
