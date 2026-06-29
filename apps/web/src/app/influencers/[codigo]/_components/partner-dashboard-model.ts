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
}

export interface OnboardingImplantationItem {
  code: string;
  label: string;
  completed: boolean;
  note?: string | null;
  completed_at?: string | null;
}

export interface OnboardingEscola {
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
}

export type PartnerCommissionSummary = {
  pending_kz: number;
  approved_kz: number;
  paid_kz: number;
  blocked_kz: number;
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
};

export type PartnerMemberRole = "owner" | "admin" | "vendas" | "implantacao" | "suporte_l1" | "operator";
export type PartnerTab = "campanha" | "crm" | "onboarding" | "materiais" | "equipe";

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
