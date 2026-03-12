import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

type CardContentProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Componente de card reutilizável com estilos padrão.
 */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200/50 p-6 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Componente para o conteúdo do card
 */
export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

// Adicione também os outros componentes se necessário
export function CardHeader({ children, className = '' }: CardContentProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: CardContentProps) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: CardContentProps) {
  return (
    <p className={`text-sm text-gray-600 mt-1 ${className}`}>
      {children}
    </p>
  );
}
