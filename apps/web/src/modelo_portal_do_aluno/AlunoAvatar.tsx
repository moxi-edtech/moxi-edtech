// src/components/aluno/shared/AlunoAvatar.tsx
'use client';

interface AlunoAvatarProps {
  initials: string;
  cor: string;
  size?: number;
  fontSize?: number;
}

export function AlunoAvatar({ initials, cor, size = 40, fontSize = 14 }: AlunoAvatarProps) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${cor}, ${cor}cc)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 800,
      fontSize,
      color: "#fff",
      flexShrink: 0,
      boxShadow: `0 2px 12px ${cor}44`,
      fontFamily: "'DM Sans', system-ui",
    }}>
      {initials}
    </div>
  );
}
