// src/components/aluno/shared/SectionTitle.tsx
'use client';

interface SectionTitleProps {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}

export function SectionTitle({ children, action, onAction }: SectionTitleProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800,
        color: "#4b5563",
        textTransform: "uppercase" as const,
        letterSpacing: "0.1em",
      }}>
        {children}
      </span>
      {action && (
        <button
          onClick={onAction}
          style={{
            fontSize: 11, color: "#4ade80",
            background: "none", border: "none",
            cursor: "pointer",
            fontFamily: "'DM Sans', system-ui",
            fontWeight: 600,
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
