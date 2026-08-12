"use client";

import { useEffect, useState } from "react";

type Props = {
  nota: number;
  max?: number;
  color?: string;
  heightClassName?: string;
  showPercent?: boolean;
};

export function NotaBar({ nota, max = 20, color = "#16a34a", heightClassName = "h-1.5", showPercent = false }: Props) {
  const [width, setWidth] = useState(0);
  const percentage = Math.min(100, Math.max(0, (nota / max) * 100));

  useEffect(() => {
    const timer = setTimeout(() => setWidth(percentage), 150);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="w-full space-y-1">
      <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${heightClassName}`}>
        <div
          className={`rounded-full transition-all duration-700 ease-out ${heightClassName}`}
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      {showPercent && (
        <div className="flex justify-end">
          <span className="text-[10px] font-bold text-slate-400">{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  );
}

