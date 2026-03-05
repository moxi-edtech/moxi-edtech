"use client";

import { useEffect, useState } from "react";

type Props = {
  nota: number;
  max?: number;
  color?: string;
};

export function NotaBar({ nota, max = 20, color = "#16a34a" }: Props) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth((nota / max) * 100), 200);
    return () => clearTimeout(timer);
  }, [nota, max]);

  return (
    <div className="h-1 rounded-full bg-slate-200">
      <div
        className="h-1 rounded-full transition-all duration-700"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}
