// src/components/aluno/shared/Pill.tsx
'use client';

interface PillProps {
  label: string;
  cor?: string;
  bg?: string;
}

export function Pill({ label, cor = "#4ade80", bg = "#0a1f12" }: PillProps) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
      color: cor, background: bg,
      border: `1px solid ${cor}33`,
      borderRadius: 20, padding: "3px 10px",
      textTransform: "uppercase" as const,
      whiteSpace: "nowrap" as const,
    }}>
      {label}
    </span>
  );
}
