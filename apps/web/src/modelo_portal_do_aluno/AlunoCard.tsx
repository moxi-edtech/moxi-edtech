// src/components/aluno/shared/AlunoCard.tsx
'use client';

import { CSSProperties, MouseEventHandler } from "react";

interface AlunoCardProps {
  children: React.ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  danger?: boolean;
  highlight?: boolean;
}

export function AlunoCard({ children, style = {}, onClick, danger, highlight }: AlunoCardProps) {
  const baseBg    = danger ? "#1c0a0a" : highlight ? "linear-gradient(135deg,#0d1f12 0%,#142a1a 100%)" : "#0f1a12";
  const baseBorder= danger ? "#dc262633" : highlight ? "#1f4028" : "#1a2e1e";
  const hoverBorder = danger ? "#dc262655" : "#2d5a36";

  return (
    <div
      onClick={onClick}
      style={{
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        borderRadius: 16,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
        ...style,
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = hoverBorder; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = baseBorder; }}
    >
      {children}
    </div>
  );
}
