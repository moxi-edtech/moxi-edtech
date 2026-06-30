import { Megaphone, School, Send, Target, Users } from "lucide-react";
import type { Database, Json } from "~types/supabase";

export interface OnboardingStep {
  code: string;
  title: string;
  status: string;
  owner: string;
  deadline?: string | null;
  completed_at?: string | null;
}

export interface OnboardingCall {
  id: string;
  realizado_em: string;
  member_name: string;
  step_title: string;
  notes: string;
}

export interface OnboardingUpload {
  id: string;
  step_code: string;
  file_path: string;
  status: string;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  document_type?: string | null;
  partner_review_note?: string | null;
  partner_reviewed_at?: string | null;
  partner_reviewed_by?: string | null;
  partner_reviewed_by_name?: string | null;
}

export interface OnboardingImplantationItem {
  code: string;
  label: string;
  completed: boolean;
  note?: string | null;
  completed_at?: string | null;
}

export interface OnboardingEscola {
  id?: string;
  onboarding_request_id?: string;
  crm_lead_id?: string | null;
  escola_id?: string | null;
  data: string;
  status: string;
  escola: string;
  plano: string | null;
  plano_label: string | null;
  total_alunos: string | null;
  token?: string;
  faixa_propina?: string | null;
  escola_tel?: string | null;
  escola_email?: string | null;
  director_nome?: string | null;
  director_tel?: string | null;
  escola_morada?: string | null;
  escola_municipio?: string | null;
  escola_provincia?: string | null;
  escola_nif?: string | null;
  implantation_status?: string | null;
  implantation_checklist?: OnboardingImplantationItem[];
  implantation_progress?: {
    completed: number;
    total: number;
  } | null;
  steps?: OnboardingStep[];
  calls?: OnboardingCall[];
  uploads?: OnboardingUpload[];
  acceptance_term_file_path?: string | null;
  acceptance_signed_by?: string | null;
  acceptance_signed_role?: string | null;
  acceptance_signed_at?: string | null;
  acceptance_validated_at?: string | null;
  acceptance_validated_by?: string | null;
  acceptance_notes?: string | null;
  risk_score?: number | null;
  risk_level?: "baixo" | "medio" | "alto" | null;
  risk_reasons?: string[] | null;
  risk_updated_at?: string | null;
}

export type PartnerCommissionSummary = {
  pending_kz: number;
  approved_kz: number;
  paid_kz: number;
  blocked_kz: number;
  requested_payout_kz?: number;
  available_payout_kz?: number;
  total_kz: number;
  count: number;
};

export type PartnerCommissionItem = {
  id: string;
  tipo: string;
  status: string;
  base_valor_kz: number;
  valor_kz: number;
  competencia_inicio: string | null;
  competencia_fim: string | null;
  created_at: string;
  escola_nome: string | null;
  payout_id?: string | null;
  payout_status?: string | null;
};

export type PartnerCommissionPayout = {
  id: string;
  status: "requested" | "approved" | "paid" | "rejected" | "cancelled";
  total_kz: number;
  receipt_file_name: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  commission_count: number;
};

export type PartnerCrmLead = {
  id: string;
  nome_escola: string;
  nome_contacto?: string | null;
  telefone?: string | null;
  email?: string | null;
  etapa?: string | null;
  plano_estimado?: string | null;
  alunos_estimados?: number | null;
  commercial_status?: string | null;
  onboarding_request_id?: string | null;
  onboarding_tracking_token?: string | null;
  tracking_token?: string | null;
  proxima_acao?: string | null;
  proxima_acao_data?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type PartnerMarketingLead = {
  id: string;
  nome: string;
  escola: string;
  whatsapp: string | null;
  email: string | null;
  score: number | null;
  status: string | null;
  created_at: string;
  crm_lead_id: string | null;
  converted_at: string | null;
};

export type PartnerPopPhase = "comercial" | "onboarding" | "setup" | "treinamento" | "suporte" | "financeiro" | "equipe";

export type PartnerPopGuide = {
  id: string;
  phase: PartnerPopPhase;
  title: string;
  summary: string;
  href: string;
  code: string;
  status: "actual" | "needs_review";
};

export const PARTNER_CONTEXTUAL_POPS: PartnerPopGuide[] = [
  {
    id: "sop-crm-01",
    phase: "comercial",
    title: "Cadastro e qualificação de leads",
    summary: "Registrar escola, contato, plano, trial, taxa de ativação e próxima ação comercial.",
    href: "/crm/pops/parceiro/sop-crm-01-cadastro-leads.html",
    code: "SOP-CRM-01",
    status: "actual",
  },
  {
    id: "sop-crm-02",
    phase: "onboarding",
    title: "Conversão de lead para onboarding",
    summary: "Converter proposta aceita em ativação oficial com tracking token e 7 etapas.",
    href: "/crm/pops/parceiro/sop-crm-02-conversao-onboarding.html",
    code: "SOP-CRM-02",
    status: "actual",
  },
  {
    id: "sop-crm-03",
    phase: "onboarding",
    title: "Triagem documental do parceiro",
    summary: "Conferir documentos, classificar pendências e encaminhar o que está pronto para KLASSE.",
    href: "/crm/pops/parceiro/sop-crm-03-moderacao-documental.html",
    code: "SOP-CRM-03",
    status: "needs_review",
  },
  {
    id: "p1-setup-config",
    phase: "setup",
    title: "Setup e configurações iniciais",
    summary: "Configurar parâmetros gerais da escola antes do go-live.",
    href: "/crm/pops/parceiro/guias-admin/p1-setup-configuracoes.html",
    code: "POP-P1-01",
    status: "actual",
  },
  {
    id: "p0-turmas-curriculo",
    phase: "setup",
    title: "Turmas, currículo e disciplinas",
    summary: "Montar estrutura acadêmica, classes, cursos, disciplinas e turmas.",
    href: "/crm/pops/parceiro/guias-admin/p0-turmas-curriculo.html",
    code: "POP-P0-03",
    status: "actual",
  },
  {
    id: "p0-alunos-admin",
    phase: "setup",
    title: "Gestão e importação de alunos",
    summary: "Validar cadastro, importação, consulta e operações essenciais de alunos.",
    href: "/crm/pops/parceiro/guias-admin/p0-alunos-admin.html",
    code: "POP-P0-02",
    status: "actual",
  },
  {
    id: "p0-avaliacao-horario",
    phase: "setup",
    title: "Avaliação, frequência e horários",
    summary: "Parametrizar avaliação, quadro de horário e integração acadêmica.",
    href: "/crm/pops/parceiro/guias-admin/p0-avaliacao-quadro-horario.html",
    code: "POP-P0-04",
    status: "actual",
  },
  {
    id: "p1-professores",
    phase: "treinamento",
    title: "Professores e atribuições",
    summary: "Orientar formação docente, atribuições e tratamento de pendências.",
    href: "/crm/pops/parceiro/guias-admin/p1-professores-atribuicoes.html",
    code: "POP-P1-03",
    status: "actual",
  },
  {
    id: "p1-fechamento",
    phase: "treinamento",
    title: "Fechamento e pauta oficial",
    summary: "Apoiar secretaria/direção no fechamento de período e emissão de pautas.",
    href: "/crm/pops/parceiro/guias-admin/p1-fechamento-periodo-pauta-oficial.html",
    code: "POP-P1-02",
    status: "actual",
  },
  {
    id: "p2-politicas-financeiras",
    phase: "financeiro",
    title: "Políticas financeiras",
    summary: "Configurar cobrança, restrição automática e parâmetros financeiros da escola.",
    href: "/crm/pops/parceiro/guias-admin/p2-configuracoes-financeiras.html",
    code: "POP-P2-01",
    status: "actual",
  },
  {
    id: "p2-mensalidades",
    phase: "financeiro",
    title: "Mensalidades e emolumentos",
    summary: "Configurar propinas, matrícula, serviços e documentos cobráveis.",
    href: "/crm/pops/parceiro/guias-admin/p2-mensalidades-emolumentos.html",
    code: "POP-P2-02",
    status: "actual",
  },
  {
    id: "sop-crm-04",
    phase: "financeiro",
    title: "Comissões e payout",
    summary: "Conferir ledger, anexar fatura/recibo e acompanhar aprovação/pagamento.",
    href: "/crm/pops/parceiro/sop-crm-04-gestao-comissoes.html",
    code: "SOP-CRM-04",
    status: "needs_review",
  },
  {
    id: "p3-docs-lote",
    phase: "suporte",
    title: "Documentos oficiais em lote",
    summary: "Apoiar emissão de documentos oficiais e tratamento de pendências.",
    href: "/crm/pops/parceiro/guias-admin/p3-documentos-oficiais-lote.html",
    code: "POP-P3-03",
    status: "actual",
  },
  {
    id: "p3-monitor",
    phase: "suporte",
    title: "Monitor de operações acadêmicas",
    summary: "Monitorar incidentes, jobs e anomalias acadêmicas com suporte L1.",
    href: "/crm/pops/parceiro/guias-admin/p3-operacoes-academicas-monitor.html",
    code: "POP-P3-04",
    status: "actual",
  },
  {
    id: "sop-crm-05",
    phase: "equipe",
    title: "Membros, funções e PINs",
    summary: "Administrar operadores locais, papéis e acesso ao portal do parceiro.",
    href: "/crm/pops/parceiro/sop-crm-05-administracao-membros.html",
    code: "SOP-CRM-05",
    status: "needs_review",
  },
];

export type PartnerMemberRole = "owner" | "admin" | "vendas" | "implantacao" | "suporte_l1" | "operator";
export type PartnerTab = "campanha" | "crm" | "onboarding" | "escolas360" | "suporte" | "pops" | "materiais" | "equipe";

export type PartnerTeamMember = {
  id: string;
  afiliado_id: string;
  nome: string;
  role: PartnerMemberRole;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type PartnerLoginMember = {
  afiliado_id: string;
  afiliado_codigo: string;
  afiliado_nome: string;
  membro_id: string;
  membro_nome: string;
};

export type PartnerOperatorProductivity = {
  membro_id: string;
  membro_nome: string;
  total_leads: number;
  active_leads: number;
  overdue_tasks: number;
  missing_next_action: number;
  won_leads: number;
  lost_leads: number;
  pipeline_value_kz: number;
};

export type PartnerSupportChannel = "whatsapp" | "telefone" | "email" | "presencial" | "portal" | "outro";
export type PartnerSupportCategory = "acesso" | "pagamentos" | "matriculas" | "notas" | "documentos" | "operacional" | "tecnico" | "outro";
export type PartnerSupportSeverity = "alta" | "media" | "baixa";
export type PartnerSupportStatus = "aberto" | "em_atendimento" | "aguardando_cliente" | "escalado_klasse" | "resolvido";

export type PartnerSupportTicket = {
  id: string;
  onboarding_request_id: string | null;
  tracking_token: string | null;
  escola_nome: string;
  canal: PartnerSupportChannel;
  categoria: PartnerSupportCategory;
  gravidade: PartnerSupportSeverity;
  status: PartnerSupportStatus;
  titulo: string;
  descricao: string | null;
  responsavel_membro_id: string | null;
  responsavel_membro_nome: string | null;
  criado_por_membro_id: string | null;
  criado_por_membro_nome: string | null;
  first_response_due_at: string;
  resolution_due_at: string;
  first_responded_at: string | null;
  resolved_at: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerSupportSummary = {
  total: number;
  open: number;
  overdue_response: number;
  overdue_resolution: number;
  escalated: number;
  resolved: number;
};

export const PARTNER_MEMBER_ROLES: PartnerMemberRole[] = [
  "owner",
  "admin",
  "vendas",
  "implantacao",
  "suporte_l1",
  "operator",
];

export const MANAGEABLE_PARTNER_MEMBER_ROLES = [
  "admin",
  "vendas",
  "implantacao",
  "suporte_l1",
  "operator",
] as const;

export const PARTNER_ROLE_LABELS: Record<PartnerMemberRole, string> = {
  owner: "Proprietário",
  admin: "Admin",
  vendas: "Vendas",
  implantacao: "Implantação",
  suporte_l1: "Suporte L1",
  operator: "Operador",
};

export interface AfiliadoStats {
  total_diagnosticos: number;
  novos: number;
  em_contacto: number;
  convertidos: number;
  onboarding?: {
    total: number;
    pendentes: number;
    em_configuracao: number;
    fechadas: number;
    escolas: OnboardingEscola[];
  };
  trend: {
    dia: string;
    total: number;
  }[];
  leads: {
    data: string;
    status: string;
    score: number;
    escola_hint: string;
  }[];
}

export type MarketingAssetRow = Database["public"]["Tables"]["marketing_assets"]["Row"];
export type MarketingAsset = Omit<MarketingAssetRow, "tipo"> & {
  tipo: "image" | "video" | "script" | "document";
};

export type AfiliadoPortalResponse = {
  ok: boolean;
  codigo: string;
  nome: string;
  member?: {
    id: string;
    name: string;
  };
  materiais: Json;
  stats: AfiliadoStats;
};

export const STEP_META: Record<string, { short: string; ownerLabel: string }> = {
  diagnostico: { short: "Diagnóstico", ownerLabel: "Parceiro Comercial" },
  docs_legais: { short: "Docs Legais", ownerLabel: "Escola" },
  planilhas: { short: "Planilhas", ownerLabel: "Escola + Parceiro" },
  validacao: { short: "Validação", ownerLabel: "KLASSE" },
  config: { short: "Configuração", ownerLabel: "Parceiro Comercial" },
  treinamento: { short: "Treinamento", ownerLabel: "Parceiro Comercial" },
  live: { short: "Go-live", ownerLabel: "KLASSE" },
};

export const CRM_STAGES: Record<string, { label: string; dot: string; color: string }> = {
  prospeccao: { label: "Prospecção", dot: "bg-slate-400", color: "bg-slate-100 text-slate-700" },
  contacto: { label: "Contacto Iniciado", dot: "bg-blue-500", color: "bg-blue-50 text-blue-700" },
  apresentacao: { label: "Demonstração", dot: "bg-purple-500", color: "bg-purple-50 text-purple-700" },
  negociacao: { label: "Negociação", dot: "bg-amber-500", color: "bg-amber-50 text-amber-700" },
  ganho: { label: "Fechado Ganho", dot: "bg-emerald-500", color: "bg-emerald-50 text-emerald-700" },
  perdido: { label: "Fechado Perdido", dot: "bg-rose-500", color: "bg-rose-50 text-rose-700" },
};

export const CRM_PLAN_OPTIONS = [
  { value: "essencial", label: "Essencial" },
  { value: "profissional", label: "Profissional" },
  { value: "premium", label: "Premium" },
] as const;

export const COMMERCIAL_STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho", color: "bg-zinc-100 text-zinc-700" },
  { value: "proposta_enviada", label: "Proposta Enviada", color: "bg-blue-50 text-blue-700" },
  { value: "aceite_comercial", label: "Aceite Comercial", color: "bg-emerald-50 text-emerald-700" },
  { value: "aguardando_contrato_klasse", label: "Aguardando Contrato KLASSE", color: "bg-amber-50 text-amber-700" },
] as const;

export const SUPPORT_CHANNEL_OPTIONS: { value: PartnerSupportChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "Email" },
  { value: "presencial", label: "Presencial" },
  { value: "portal", label: "Portal" },
  { value: "outro", label: "Outro" },
];

export const SUPPORT_CATEGORY_OPTIONS: { value: PartnerSupportCategory; label: string }[] = [
  { value: "acesso", label: "Acesso" },
  { value: "pagamentos", label: "Pagamentos" },
  { value: "matriculas", label: "Matrículas" },
  { value: "notas", label: "Notas" },
  { value: "documentos", label: "Documentos" },
  { value: "operacional", label: "Operacional" },
  { value: "tecnico", label: "Técnico" },
  { value: "outro", label: "Outro" },
];

export const SUPPORT_SEVERITY_CONFIG: Record<PartnerSupportSeverity, { label: string; color: string; sla: string }> = {
  alta: { label: "Alta", color: "bg-rose-50 text-rose-700 border-rose-100", sla: "15 min / 2h" },
  media: { label: "Média", color: "bg-amber-50 text-amber-700 border-amber-100", sla: "1h / 8h" },
  baixa: { label: "Baixa", color: "bg-emerald-50 text-emerald-700 border-emerald-100", sla: "4h / 24h" },
};

export const SUPPORT_STATUS_CONFIG: Record<PartnerSupportStatus, { label: string; color: string }> = {
  aberto: { label: "Aberto", color: "bg-blue-50 text-blue-700 border-blue-100" },
  em_atendimento: { label: "Em atendimento", color: "bg-purple-50 text-purple-700 border-purple-100" },
  aguardando_cliente: { label: "Aguardando cliente", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  escalado_klasse: { label: "Escalado KLASSE", color: "bg-rose-50 text-rose-700 border-rose-100" },
  resolvido: { label: "Resolvido", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
};

export const DEFAULT_IMPLANTATION_CHECKLIST: OnboardingImplantationItem[] = [
  { code: "curriculo_configurado", label: "Currículo configurado", completed: false, note: null, completed_at: null },
  { code: "turmas_criadas", label: "Turmas criadas", completed: false, note: null, completed_at: null },
  { code: "disciplinas_configuradas", label: "Disciplinas e pautas configuradas", completed: false, note: null, completed_at: null },
  { code: "alunos_importados", label: "Alunos importados", completed: false, note: null, completed_at: null },
  { code: "encarregados_importados", label: "Encarregados importados", completed: false, note: null, completed_at: null },
  { code: "formacao_secretaria_concluida", label: "Formação da secretaria concluída", completed: false, note: null, completed_at: null },
  { code: "formacao_docentes_concluida", label: "Formação dos docentes concluída", completed: false, note: null, completed_at: null },
  { code: "sistema_em_operacao", label: "Sistema em operação", completed: false, note: null, completed_at: null },
];

export const IMPLANTATION_STATUS_CONFIG = {
  implantacao_em_andamento: { label: "Implantação em andamento", color: "bg-blue-50 text-blue-700 border-blue-100" },
  aguardando_aceite: { label: "Aguardando aceite", color: "bg-amber-50 text-amber-700 border-amber-100" },
  aceite_validado: { label: "Aceite validado", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
} as const;

export function normalizeImplantationChecklist(
  items: OnboardingImplantationItem[] | null | undefined
): OnboardingImplantationItem[] {
  const byCode = new Map((items ?? []).map((item) => [item.code, item]));
  return DEFAULT_IMPLANTATION_CHECKLIST.map((baseItem) => {
    const current = byCode.get(baseItem.code);
    return {
      ...baseItem,
      completed: Boolean(current?.completed),
      note: current?.note ?? null,
      completed_at: current?.completed_at ?? null,
      label: current?.label || baseItem.label,
    };
  });
}

export function getImplantationProgress(escola: OnboardingEscola | null | undefined) {
  const fallbackChecklist = normalizeImplantationChecklist(escola?.implantation_checklist);
  if (
    escola?.implantation_progress &&
    typeof escola.implantation_progress.completed === "number" &&
    typeof escola.implantation_progress.total === "number"
  ) {
    return escola.implantation_progress;
  }

  return {
    completed: fallbackChecklist.filter((item) => item.completed).length,
    total: fallbackChecklist.length,
  };
}

export function getLeadConversionBlockers(lead: {
  onboarding_request_id?: string | null;
  etapa?: string | null;
  plano_estimado?: string | null;
  trial_days?: number | null;
  taxa_ativacao?: number | null;
  commercial_status?: string | null;
}) {
  if (lead.onboarding_request_id) return [];

  const blockers: string[] = [];
  const validPlan = CRM_PLAN_OPTIONS.some((plan) => plan.value === lead.plano_estimado);
  const trialDays = Number(lead.trial_days);
  const taxaAtivacao = Number(lead.taxa_ativacao);

  if (lead.etapa !== "ganho") {
    blockers.push("Marque o lead como Fechado Ganho antes de iniciar a ativação.");
  }

  if (!validPlan) {
    blockers.push("Defina um plano comercial válido.");
  }

  if (!Number.isFinite(trialDays) || trialDays < 0 || trialDays > 30) {
    blockers.push("O trial precisa estar entre 0 e 30 dias.");
  }

  if (!Number.isFinite(taxaAtivacao) || taxaAtivacao <= 0) {
    blockers.push("A taxa de ativação precisa ser maior que zero.");
  }

  if (!["aceite_comercial", "aguardando_contrato_klasse"].includes(lead.commercial_status || "")) {
    blockers.push("Registre a proposta e o aceite comercial antes de iniciar a ativação.");
  }

  return blockers;
}

export function getStepMeta(stepCode: string, owner: string) {
  return STEP_META[stepCode] ?? {
    short: stepCode,
    ownerLabel: owner === "escola" ? "Escola" : owner === "parceiro" ? "Parceiro Comercial" : "KLASSE",
  };
}

export function getLatestOnboardingCall(escola?: OnboardingEscola | null): OnboardingCall | null {
  if (!escola?.calls?.length) return null;
  return [...escola.calls].sort(
    (a, b) => new Date(b.realizado_em).getTime() - new Date(a.realizado_em).getTime()
  )[0] ?? null;
}

export function getLatestOnboardingCallForStep(
  escola: OnboardingEscola | null | undefined,
  stepCode: string,
  stepTitle: string
): OnboardingCall | null {
  if (!escola?.calls?.length) return null;

  return (
    [...escola.calls]
      .filter((call) => {
        if (!call.step_title) return false;
        const normalizedCall = call.step_title.trim().toLowerCase();
        const normalizedTitle = stepTitle.trim().toLowerCase();
        const normalizedMeta = getStepMeta(stepCode, "").short.trim().toLowerCase();
        return normalizedCall === normalizedTitle || normalizedCall === normalizedMeta;
      })
      .sort((a, b) => new Date(b.realizado_em).getTime() - new Date(a.realizado_em).getTime())[0] ?? null
  );
}

export function isMarketingAsset(value: MarketingAssetRow): value is MarketingAsset {
  return ["image", "video", "script", "document"].includes(value.tipo);
}

export function isAfiliadoStats(value: unknown): value is AfiliadoStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, Json | undefined>;
  return (
    typeof candidate.total_diagnosticos === "number" &&
    typeof candidate.novos === "number" &&
    typeof candidate.em_contacto === "number" &&
    typeof candidate.convertidos === "number" &&
    Array.isArray(candidate.leads) &&
    Array.isArray(candidate.trend)
  );
}

export function isAfiliadoPortalResponse(value: unknown): value is AfiliadoPortalResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, Json | undefined>;
  return (
    typeof candidate.ok === "boolean" &&
    typeof candidate.codigo === "string" &&
    typeof candidate.nome === "string" &&
    isAfiliadoStats(candidate.stats ?? null)
  );
}

export const STATUS_CONFIG = {
  'NOVO': { label: "Novo", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  'EM_CONTACTO': { label: "Em Contacto", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  'CONVERTIDO': { label: "Convertido", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  'PERDIDO': { label: "Arquivado", color: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

export const ONBOARDING_STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  em_configuracao: { label: "Em atendimento", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  activo: { label: "Fechada", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  cancelado: { label: "Arquivada", color: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

export const WEEKLY_ACTIONS = [
  "Publicar 1 story sobre matrícula online e portal do aluno.",
  "Enviar a mensagem pronta para 10 diretores ou coordenadores.",
  "Responder interessados com o link de diagnóstico da escola.",
];

export const CAMPAIGN_KITS = [
  {
    title: "Post para pais",
    audience: "Pais e alunos",
    icon: Users,
    linkType: "campaign",
    copy: "A escola do seu filho ainda depende de fila, papel e WhatsApp para matrícula, notas e documentos? Uma escola moderna já oferece matrícula online e portal do aluno. Envie isto para a direção.",
  },
  {
    title: "Story com enquete",
    audience: "Instagram/TikTok",
    icon: Megaphone,
    linkType: "campaign",
    copy: "Enquete: A escola do seu filho já tem portal do aluno? Responde: Sim, já tem / Ainda não tem. Se ainda não tem, envia este link para a direção.",
  },
  {
    title: "Mensagem para grupo de encarregados",
    audience: "Grupos WhatsApp",
    icon: Send,
    linkType: "campaign",
    copy: "Pais, encontrei uma solução que ajuda escolas a terem matrícula online, portal do aluno, notas, avisos e documentos digitais. Acho que devíamos partilhar com a direção da escola.",
  },
  {
    title: "Mensagem para diretor",
    audience: "Direção escolar",
    icon: School,
    linkType: "diagnosis",
    copy: "Diretor, os pais já começam a comparar escolas pela experiência digital. O KLASSE ajuda com matrícula online, portal do aluno e gestão escolar. Inicie o pedido para a equipa avaliar a modernização da sua escola.",
  },
  {
    title: "Comentário curto para marcar escola",
    audience: "Comentários",
    icon: Target,
    linkType: "campaign",
    copy: "A nossa escola precisa ver isto. Matrícula online e portal do aluno já deviam ser padrão.",
  },
] as const;
