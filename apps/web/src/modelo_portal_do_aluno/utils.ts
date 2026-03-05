// src/components/aluno/utils.ts
// Utilitários partilhados por todos os componentes do portal do aluno

export const fmtKz = (valor: number): string =>
  `Kz ${valor.toLocaleString("pt-AO")}`;

export const fmtHora = (timestamp: string): string => {
  const d    = new Date(timestamp);
  const now  = new Date();
  const diff = (now.getTime() - d.getTime()) / 36e5;
  if (diff < 1)  return `${Math.round(diff * 60)}min atrás`;
  if (diff < 24) return `${Math.round(diff)}h atrás`;
  return d.toLocaleDateString("pt-AO");
};

export const mediaNotas = (notas: { nota: number }[]): string =>
  (notas.reduce((s, n) => s + n.nota, 0) / notas.length).toFixed(1);

export const notaColor = (nota: number): string =>
  nota >= 14 ? "#4ade80" : nota >= 10 ? "#fbbf24" : "#f87171";

export const notaBg = (nota: number): string =>
  nota >= 14 ? "#0a1f12" : nota >= 10 ? "#1a1500" : "#1c0a0a";

export const presencaCor = (pct: number): string =>
  pct >= 90 ? "#4ade80" : pct >= 75 ? "#fbbf24" : "#f87171";

export const shortSchoolName = (nome: string | null): string => {
  if (!nome) return "Portal Aluno";
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return nome;
  return parts.slice(0, 2).join(" ");
};
