/** Shared geometry for desktop navigation. Routes and authorization are owned by each portal. */
export const SIDEBAR_WIDTH = { expanded: "256px", collapsed: "80px" } as const;
export const SIDEBAR_NAV = "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden";
export const SIDEBAR_ROW = "flex w-full min-w-0 min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm";
export const SIDEBAR_SUBROW = "flex w-full min-w-0 min-h-9 items-center gap-2 rounded-xl px-2 py-1.5 text-xs";
export const SIDEBAR_LABEL = "min-w-0 flex-1 truncate text-left";
const SHORT_LABELS: Readonly<Record<string, string>> = {
  "Matrículas & Admissões": "Matrículas",
  "Operações Académicas": "Académico",
  "Operações Acadêmicas": "Académico",
  "Turmas & Classes": "Turmas",
  "Horários & Calendário": "Horários",
  "Pendências de reconciliação": "Reconciliação pendente",
  "Candidaturas com pagamento": "Pag. de candidaturas",
  "Calendário de avaliações": "Calendário de provas",
  "Reconciliação Histórica": "Reconciliação",
  "Reclassificação de Finalistas": "Finalistas",
  "Cockpit de Prontidão": "Prontidão",
  "Emissão de Declarações": "Declarações",
  "Documentos Oficiais (MED)": "Docs. oficiais",
  "Documentos Oficiais": "Docs. oficiais",
  "Radar de inadimplência": "Inadimplência",
  "Mapa de Aproveitamento": "Aproveitamento",
  "Histórico de importações": "Importações",
  "Histórico de Importações": "Importações",
  "Integração de Dados": "Integrações",
  "Mensalidades & emolumentos": "Taxas e propinas",
  "Mensalidades & Emolumentos": "Taxas e propinas",
  "Fiscal & Compliance": "Fiscal",
  "Acessos ao Portal": "Acessos",
  "Acesso ao Portal": "Acessos",
  "WhatsApp KLASSE": "WhatsApp",
  "Gerenciar Usuários": "Utilizadores",
  "Gerenciar Escolas": "Escolas",
  "Usuários": "Utilizadores",
  "Diagnostics": "Diagnóstico",
  "Fechamento Trimestral": "Fecho trimestral",
  "Janelas de rematrícula": "Janelas de rematrícula",
  "Pendências pós-virada": "Pendências pós-virada",
  "Financeiro · Políticas": "Políticas financeiras",
  "Mensalidades e preços": "Propinas e preços",
  "Centros Formação": "Centros de formação",
};
/** Keep the canonical full label available to assistive technology and tooltips. */
export function sidebarLabel(label: string): string {
  return Object.prototype.hasOwnProperty.call(SHORT_LABELS, label) ? SHORT_LABELS[label] : label;
}
