"use client";

import { Progress } from "~/components/ui/Progress";

interface ProgressInfoProps {
  step: number;
  total: number;
}

export function ProgressInfo({ step, total }: ProgressInfoProps) {
  const percentage = Math.round((step / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>Etapa {step} de {total}</span>
        <span>{percentage}%</span>
      </div>
      <Progress value={percentage} />
    </div>
  );
}
