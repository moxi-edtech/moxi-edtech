// app/.../components/StepHeader.tsx
import type { ReactNode } from 'react';

type StepHeaderProps = {
  icone: ReactNode;
  titulo: string;
  descricao: string;
};

export function StepHeader({ icone, titulo, descricao }: StepHeaderProps) {
  return (
    <div className="flex items-start space-x-4 pb-6 border-b">
      <div className="flex-shrink-0">{icone}</div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
        <p className="text-gray-600 mt-1">{descricao}</p>
      </div>
    </div>
  );
}
