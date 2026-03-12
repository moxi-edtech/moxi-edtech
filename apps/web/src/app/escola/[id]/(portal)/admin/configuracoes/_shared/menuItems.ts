export type ConfigMenuItem = {
  label: string;
  href: string;
};

export const buildConfigMenuItems = (base: string): ConfigMenuItem[] => [
  { label: "Calendário Acadêmico", href: `${base}/calendario` },
  { label: "Avaliação & Notas", href: `${base}/avaliacao` },
  { label: "Turmas & Currículo", href: `${base}/turmas` },
  { label: "Financeiro", href: `${base}/financeiro` },
  { label: "Mensalidades & Emolumentos", href: `${base}/mensalidades` },
  { label: "Fluxos de Aprovação", href: `${base}/fluxos` },
  { label: "Avançado", href: `${base}/avancado` },
];
