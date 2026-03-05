// src/components/aluno/shared/NotaBar.tsx
'use client';

import { useEffect, useState } from "react";
import { notaColor } from "../utils";

interface NotaBarProps {
  nota: number;
  max?: number;
  delay?: number;
}

export function NotaBar({ nota, max = 20, delay = 200 }: NotaBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth((nota / max) * 100), delay);
    return () => clearTimeout(t);
  }, [nota, max, delay]);

  const cor = notaColor(nota);

  return (
    <div style={{ height: 4, background: "#1a2e1e", borderRadius: 4, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${width}%`,
        borderRadius: 4,
        background: cor,
        boxShadow: `0 0 6px ${cor}88`,
        transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}
