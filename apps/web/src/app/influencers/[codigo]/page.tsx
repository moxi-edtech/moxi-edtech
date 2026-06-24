"use client";

import { useEffect, useState, use } from "react";
import { 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  Users, 
  ChevronLeft, 
  ShieldCheck, 
  Zap,
  TrendingUp,
  Award,
  Loader2,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Video,
  Copy,
  Download,
  ArrowRight,
  Megaphone,
  School,
  Send,
  Target,
  Phone,
  LayoutGrid,
  List,
  Plus,
  KeyRound,
  FileQuestion,
  TrendingDown,
  Check,
  Calendar,
  Share2,
  ExternalLink
} from "lucide-react";
import { 
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Database, Json } from "~types/supabase";
import PartnerAppShell from "@/components/layout/influencer/PartnerAppShell";

interface OnboardingStep {
  code: string;
  title: string;
  status: string;
  owner: string;
  deadline?: string | null;
  completed_at?: string | null;
}

interface OnboardingCall {
  id: string;
  realizado_em: string;
  member_name: string;
  step_title: string;
  notes: string;
}

interface OnboardingUpload {
  id: string;
  step_code: string;
  file_path: string;
  status: string;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
}

interface OnboardingEscola {
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
  steps?: OnboardingStep[];
  calls?: OnboardingCall[];
  uploads?: OnboardingUpload[];
}

interface AfiliadoStats {
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

type MarketingAssetRow = Database["public"]["Tables"]["marketing_assets"]["Row"];
type MarketingAsset = Omit<MarketingAssetRow, "tipo"> & {
  tipo: "image" | "video" | "script" | "document";
};

type AfiliadoPortalResponse = {
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

const STEP_META: Record<string, { short: string; ownerLabel: string }> = {
  diagnostico: { short: "Diagnóstico", ownerLabel: "Parceiro Comercial" },
  docs_legais: { short: "Docs Legais", ownerLabel: "Escola" },
  planilhas: { short: "Planilhas", ownerLabel: "Escola" },
  validacao: { short: "Validação", ownerLabel: "KLASSE" },
  config: { short: "Configuração", ownerLabel: "Parceiro Comercial" },
  treinamento: { short: "Treinamento", ownerLabel: "Parceiro Comercial" },
  live: { short: "Go-live", ownerLabel: "KLASSE" },
};

const CRM_STAGES: Record<string, { label: string; dot: string; color: string }> = {
  prospeccao: { label: "Prospecção", dot: "bg-slate-400", color: "bg-slate-100 text-slate-700" },
  contacto: { label: "Contacto Iniciado", dot: "bg-blue-500", color: "bg-blue-50 text-blue-700" },
  apresentacao: { label: "Demonstração", dot: "bg-purple-500", color: "bg-purple-50 text-purple-700" },
  negociacao: { label: "Negociação", dot: "bg-amber-500", color: "bg-amber-50 text-amber-700" },
  ganho: { label: "Fechado Ganho", dot: "bg-emerald-500", color: "bg-emerald-50 text-emerald-700" },
  perdido: { label: "Fechado Perdido", dot: "bg-rose-500", color: "bg-rose-50 text-rose-700" },
};

function getStepMeta(stepCode: string, owner: string) {
  return STEP_META[stepCode] ?? {
    short: stepCode,
    ownerLabel: owner === "escola" ? "Escola" : owner === "parceiro" ? "Parceiro Comercial" : "KLASSE",
  };
}

function isMarketingAsset(value: MarketingAssetRow): value is MarketingAsset {
  return ["image", "video", "script", "document"].includes(value.tipo);
}

function isAfiliadoStats(value: unknown): value is AfiliadoStats {
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

function isAfiliadoPortalResponse(value: unknown): value is AfiliadoPortalResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, Json | undefined>;
  return (
    typeof candidate.ok === "boolean" &&
    typeof candidate.codigo === "string" &&
    typeof candidate.nome === "string" &&
    isAfiliadoStats(candidate.stats ?? null)
  );
}

const STATUS_CONFIG = {
  'NOVO': { label: "Novo", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  'EM_CONTACTO': { label: "Em Contacto", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  'CONVERTIDO': { label: "Convertido", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  'PERDIDO': { label: "Arquivado", color: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

const ONBOARDING_STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  em_configuracao: { label: "Em atendimento", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  activo: { label: "Fechada", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  cancelado: { label: "Arquivada", color: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

const WEEKLY_ACTIONS = [
  "Publicar 1 story sobre matrícula online e portal do aluno.",
  "Enviar a mensagem pronta para 10 diretores ou coordenadores.",
  "Responder interessados com o link de diagnóstico da escola.",
];

const CAMPAIGN_KITS = [
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

export default function AfiliadoDashboardPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const [stats, setStats] = useState<AfiliadoStats | null>(null);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "operator">("operator");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'campanha' | 'crm' | 'onboarding' | 'materiais'>('crm');
  const [authError, setAuthError] = useState(false);
  const router = useRouter();
  const campaignUrl = `https://klasse.ao/escola-moderna?ref=${codigo}`;
  const onboardingUrl = `https://app.klasse.ao/onboarding?ref=${codigo}`;
  const onboardingStats = stats?.onboarding;

  // Switcher de Pipeline Comercial vs Ativação
  const pipelineMode = activeTab === 'crm' ? 'leads' : 'onboarding';
  const [crmLeads, setCrmLeads] = useState<any[]>([]);
  const [loadingCrm, setLoadingCrm] = useState(false);

  // Form states for registering a new CRM lead
  const [crmModalOpen, setCrmModalOpen] = useState(false);
  const [newLeadSchoolName, setNewLeadSchoolName] = useState("");
  const [newLeadContactName, setNewLeadContactName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadSegment, setNewLeadSegment] = useState<"publica" | "privada" | "comparticipada">("privada");
  const [newLeadAlunos, setNewLeadAlunos] = useState(300);
  const [newLeadPlan, setNewLeadPlan] = useState<"essencial" | "profissional" | "premium">("essencial");
  const [newLeadAction, setNewLeadAction] = useState("");
  const [newLeadActionDate, setNewLeadActionDate] = useState("");
  const [savingLead, setSavingLead] = useState(false);

  // Detail states for CRM leads (Drawer)
  const [selectedCrmLead, setSelectedCrmLead] = useState<any | null>(null);
  const [crmLeadDrawerOpen, setCrmLeadDrawerOpen] = useState(false);
  const [updatingLeadStage, setUpdatingLeadStage] = useState(false);
  const [nextLeadAction, setNextLeadAction] = useState("");
  const [nextLeadActionDate, setNextLeadActionDate] = useState("");
  const [leadActionNotes, setLeadActionNotes] = useState("");
  const [savingLeadAction, setSavingLeadAction] = useState(false);
  const [leadHistory, setLeadHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedStageToChange, setSelectedStageToChange] = useState("");
  const [lossReasonText, setLossReasonText] = useState("");

  const [callModalOpen, setCallModalOpen] = useState(false);
  const [selectedSchoolForCall, setSelectedSchoolForCall] = useState<OnboardingEscola | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [selectedStepCodeForCall, setSelectedStepCodeForCall] = useState("");
  const [savingCall, setSavingCall] = useState(false);
  const [selectedSchoolForDetails, setSelectedSchoolForDetails] = useState<OnboardingEscola | null>(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  const loadCrmLeads = async (showLoading = false) => {
    if (showLoading) setLoadingCrm(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { ok?: boolean; leads?: any[]; error?: string } | null;
      if (response.ok && payload?.ok && payload.leads) {
        setCrmLeads(payload.leads);
        if (selectedCrmLead) {
          const updated = payload.leads.find(l => l.id === selectedCrmLead.id);
          if (updated) {
            setSelectedCrmLead(updated);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load CRM leads:", err);
    } finally {
      if (showLoading) setLoadingCrm(false);
    }
  };

  const loadLeadHistory = async (leadId: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads/${leadId}/history`);
      const json = await response.json().catch(() => null) as { ok?: boolean; history?: any[] } | null;
      if (response.ok && json?.ok && json.history) {
        setLeadHistory(json.history);
      }
    } catch (err) {
      console.error("Failed to load lead history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenLeadDrawer = async (lead: any) => {
    setSelectedCrmLead(lead);
    setNextLeadAction(lead.proxima_acao || "");
    setNextLeadActionDate(lead.proxima_acao_data ? new Date(lead.proxima_acao_data).toISOString().split('T')[0] : "");
    setLeadActionNotes("");
    setSelectedStageToChange(lead.etapa);
    setLossReasonText(lead.motivo_perda || "");
    setCrmLeadDrawerOpen(true);
    await loadLeadHistory(lead.id);
  };

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/portal`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        portal?: AfiliadoPortalResponse;
        assets?: MarketingAssetRow[];
        member?: { name?: string; role?: string };
      } | null;

      if (!response.ok || !payload?.ok || !payload.portal || !isAfiliadoPortalResponse(payload.portal)) {
        setAuthError(true);
        return;
      }

      setAuthError(false);
      setStats(payload.portal.stats);
      setMemberName(typeof payload.member?.name === "string" ? payload.member.name : "");
      setMemberRole((payload.member?.role === "owner" || payload.member?.role === "operator") ? payload.member.role : "operator");
      setAssets((payload.assets || []).filter(isMarketingAsset));

      if (selectedSchoolForDetails) {
        const updatedSchool = payload.portal.stats.onboarding?.escolas.find(
          (e: any) => e.token === selectedSchoolForDetails.token
        );
        if (updatedSchool) {
          setSelectedSchoolForDetails(updatedSchool);
        }
      }

      await loadCrmLeads(false);
    } catch (err) {
      console.error(err);
      setAuthError(true);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    if (!newLeadSchoolName.trim()) return;
    setSavingLead(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          nome_escola: newLeadSchoolName.trim(),
          nome_contacto: newLeadContactName.trim() || null,
          telefone: newLeadPhone.trim() || null,
          email: newLeadEmail.trim() || null,
          segmento: newLeadSegment,
          alunos_estimados: Number(newLeadAlunos) || 0,
          plano_estimado: newLeadPlan,
          proxima_acao: newLeadAction.trim() || null,
          proxima_acao_data: newLeadActionDate || null,
        }),
      });
      const res = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !res?.ok) {
        toast.error(res?.error || "Erro ao cadastrar o lead.");
        return;
      }

      toast.success("Lead cadastrado com sucesso no CRM!");
      setCrmModalOpen(false);
      setNewLeadSchoolName("");
      setNewLeadContactName("");
      setNewLeadPhone("");
      setNewLeadEmail("");
      setNewLeadSegment("privada");
      setNewLeadAlunos(300);
      setNewLeadPlan("essencial");
      setNewLeadAction("");
      setNewLeadActionDate("");
      
      await loadCrmLeads(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao cadastrar o lead.");
    } finally {
      setSavingLead(false);
    }
  };

  const handleUpdateLeadStage = async (leadId: string, newStage: string) => {
    setUpdatingLeadStage(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          etapa: newStage,
          motivo_perda: newStage === 'perdido' ? lossReasonText.trim() : null,
        }),
      });
      const res = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !res?.ok) {
        toast.error(res?.error || "Erro ao atualizar etapa.");
        return;
      }

      toast.success("Etapa do lead atualizada!");
      await loadCrmLeads(false);
      await loadLeadHistory(leadId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao atualizar etapa.");
    } finally {
      setUpdatingLeadStage(false);
    }
  };

  const handleUpdateLeadAction = async () => {
    if (!selectedCrmLead) return;
    setSavingLeadAction(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads/${selectedCrmLead.id}/action`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          proxima_acao: nextLeadAction.trim() || null,
          proxima_acao_data: nextLeadActionDate || null,
          interaction_note: leadActionNotes.trim() || null,
        }),
      });
      const res = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !res?.ok) {
        toast.error(res?.error || "Erro ao registrar histórico.");
        return;
      }

      toast.success("Ação e histórico atualizados com sucesso!");
      setLeadActionNotes("");
      await loadCrmLeads(false);
      await loadLeadHistory(selectedCrmLead.id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao registrar histórico.");
    } finally {
      setSavingLeadAction(false);
    }
  };

  const handleRegisterCall = async () => {
    if (!selectedSchoolForCall) return;
    setSavingCall(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/calls`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          onboardingToken: selectedSchoolForCall.token,
          stepCode: selectedStepCodeForCall || null,
          notes: callNotes,
        }),
      });
      const res = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !res?.ok) {
        if (response.status === 401) {
          setAuthError(true);
        }
        toast.error(res?.error || "Erro ao registrar a ligação.");
        return;
      }

      toast.success("Ligação registrada com sucesso!");
      setCallModalOpen(false);
      setCallNotes("");
      setSelectedStepCodeForCall("");
      await loadData(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao registrar a ligação.");
    } finally {
      setSavingCall(false);
    }
  };

  const [onboardingFilter, setOnboardingFilter] = useState<'todos' | 'pendente' | 'atrasado' | 'concluido'>('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('kanban');

  // Calculations for filters and pending steps
  const schoolsList = onboardingStats?.escolas || [];
  const countTodos = schoolsList.length;
  const countConcluido = schoolsList.filter(e => e.status === 'activo').length;
  const countPendente = schoolsList.filter(e => e.status === 'pendente' || e.status === 'em_configuracao').length;
  const countAtrasado = schoolsList.filter(e => 
    e.steps?.some(st => st.status !== 'concluido' && st.deadline && new Date(st.deadline).getTime() < Date.now())
  ).length;

  const pendingStepsStats = schoolsList.reduce((acc, esc) => {
    if (esc.status !== 'activo' && esc.steps) {
      esc.steps.forEach(st => {
        if (st.status !== 'concluido') {
          const owner = st.owner === 'escola' ? 'Escola' : st.owner === 'parceiro' ? 'Parceiro' : 'KLASSE';
          acc[owner] = (acc[owner] || 0) + 1;
        }
      });
    }
    return acc;
  }, {} as Record<string, number>);

  const pendingStepCodeStats = schoolsList.reduce((acc, esc) => {
    if (esc.status !== 'activo' && esc.steps) {
      esc.steps.forEach(st => {
        if (st.status !== 'concluido') {
          const code = typeof st.code === 'string' ? st.code : 'desconhecida';
          acc[code] = (acc[code] || 0) + 1;
        }
      });
    }
    return acc;
  }, {} as Record<string, number>);

  const filteredSchools = schoolsList.filter(escola => {
    if (onboardingFilter === 'todos') return true;
    if (onboardingFilter === 'concluido') {
      return escola.status === 'activo';
    }
    
    const isSchoolOverdue = escola.steps?.some(st => 
      st.status !== 'concluido' && st.deadline && new Date(st.deadline).getTime() < Date.now()
    ) ?? false;

    if (onboardingFilter === 'atrasado') {
      return isSchoolOverdue;
    }
    if (onboardingFilter === 'pendente') {
      return escola.status === 'pendente' || escola.status === 'em_configuracao';
    }
    return true;
  });

  // Commission Calculator States
  const [calcPlan, setCalcPlan] = useState<'essencial' | 'profissional' | 'premium'>('essencial');
  const [calcAlunos, setCalcAlunos] = useState<number>(300);

  const calcComissaoEscola = (plano: string | null, _totalAlunos: string | null) => {
    const planKey = String(plano || "").toLowerCase();
    let basePrice = 80000;
    if (planKey === 'profissional') basePrice = 140000;
    if (planKey === 'premium') basePrice = 250000;
    return basePrice * 0.25;
  };

  const totalComissao = onboardingStats?.escolas?.reduce((acc, esc) => {
    if (esc.status === 'activo') {
      return acc + calcComissaoEscola(esc.plano, esc.total_alunos);
    }
    return acc;
  }, 0) || 0;

  // Pre-Sales CRM Commission Pipeline Value
  const getCommissionForPlan = (plano: string) => {
    let basePrice = 80000;
    if (plano === 'profissional') basePrice = 140000;
    if (plano === 'premium') basePrice = 250000;
    return basePrice * 0.25;
  };

  const activeCrmLeads = crmLeads.filter(l => l.etapa !== 'perdido');
  const totalCrmLeadsCount = activeCrmLeads.length;
  const newCrmLeadsCount = activeCrmLeads.filter(l => l.etapa === 'prospeccao').length;
  const inContactCrmCount = activeCrmLeads.filter(l => l.etapa === 'contacto' || l.etapa === 'apresentacao').length;
  const negotiatingCrmCount = activeCrmLeads.filter(l => l.etapa === 'negociacao').length;

  const totalCrmPipelineValue = activeCrmLeads.reduce((acc, lead) => {
    return acc + getCommissionForPlan(lead.plano_estimado);
  }, 0);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  useEffect(() => {
    loadData(true);
  }, [codigo]);

  const handleLogout = async () => {
    await fetch("/api/influencers/session", { method: "DELETE" }).catch(() => null);
    router.push("/influencers");
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full p-8 rounded-[32px] space-y-6 shadow-xl">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">Acesso Restrito</h2>
            <p className="text-slate-500">A sua sessão expirou ou o acesso é inválido. Por favor, valide o seu código e PIN novamente.</p>
          </div>
          <Button onClick={() => router.push('/influencers')} className="w-full bg-slate-900 py-6 rounded-2xl font-bold">
            Voltar para Login
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-klasse-gold mx-auto" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">A carregar o seu desempenho...</p>
        </div>
      </div>
    );
  }

  const countPendenteLeads = crmLeads.filter(
    (l) =>
      l.etapa !== 'ganho' &&
      l.etapa !== 'perdido' &&
      l.proxima_acao_data &&
      new Date(l.proxima_acao_data).getTime() < Date.now()
  ).length;
  const countPendenteOnboarding = schoolsList.filter(
    (e) => e.status === 'pendente' || e.status === 'em_configuracao'
  ).length;

  return (
    <PartnerAppShell
      codigo={codigo}
      memberName={memberName}
      memberRole={memberRole}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      stats={stats}
      totalComissao={totalComissao}
      countPendenteLeads={countPendenteLeads}
      countPendenteOnboarding={countPendenteOnboarding}
      onLogout={handleLogout}
    >
      <Tabs defaultValue="crm" value={activeTab} onValueChange={setActiveTab as any} className="w-full">
          <TabsContent value="campanha" className="m-0 space-y-8">
            <Card className="overflow-hidden rounded-[32px] border-slate-200 bg-slate-950 text-white shadow-xl">
              <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
                <div className="space-y-6">
                  <Badge className="w-fit border border-white/10 bg-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-klasse-gold">
                    Missão da semana
                  </Badge>
                  <div className="space-y-3">
                    <h2 className="max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
                      Fazer escolas sentirem que precisam de matrícula online e portal do aluno.
                  </h2>
                    <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-300 md:text-base">
                      A campanha pública cria pressão social. O diagnóstico entra depois, quando o diretor quer saber se a escola está pronta para modernizar.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {WEEKLY_ACTIONS.map((action, index) => (
                      <div key={action} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-klasse-gold text-xs font-black text-slate-950">
                          {index + 1}
                        </div>
                        <p className="text-xs font-bold leading-relaxed text-slate-200">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-klasse-gold text-slate-950">
                      <Megaphone size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Oferta pública</p>
                      <h3 className="font-black text-white">Escola Moderna</h3>
                    </div>
                  </div>
                  <p className="mb-5 text-sm font-medium leading-relaxed text-slate-300">
                    Use este link para posts, stories e mensagens para pais. Ele apresenta a ideia de modernização antes de pedir o diagnóstico.
                  </p>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                      <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Link principal</p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-xs font-bold text-klasse-gold">{campaignUrl}</code>
                        <Button onClick={() => copyToClipboard(campaignUrl)} className="h-9 rounded-xl bg-white px-3 text-[10px] font-black text-slate-950 hover:bg-slate-100">
                          <Copy size={13} />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                      <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Pedido para diretores</p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-xs font-bold text-slate-300">{onboardingUrl}</code>
                        <Button onClick={() => copyToClipboard(onboardingUrl)} className="h-9 rounded-xl bg-white/10 px-3 text-[10px] font-black text-white hover:bg-white/20">
                          <Copy size={13} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
              {CAMPAIGN_KITS.map((kit) => (
                <Card key={kit.title} className="rounded-[28px] border-slate-200 bg-white shadow-sm">
                  <CardContent className="flex h-full flex-col gap-5 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <kit.icon size={22} />
                      </div>
                      <Badge variant="outline" className="rounded-xl text-[9px] font-black uppercase tracking-widest">
                        {kit.audience}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-black tracking-tight text-slate-900">{kit.title}</h3>
                      <p className="text-sm font-medium leading-relaxed text-slate-600">{kit.copy}</p>
                    </div>
                    <Button
                      onClick={() => copyToClipboard(`${kit.copy}\n\n${kit.linkType === "diagnosis" ? onboardingUrl : campaignUrl}`)}
                      className="mt-auto h-11 rounded-xl bg-slate-900 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800"
                    >
                      <Copy size={14} />
                      Copiar mensagem
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="rounded-[28px] border-amber-100 bg-amber-50 shadow-sm">
                <CardContent className="space-y-4 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Target size={22} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-black text-amber-950">Quando usar o pedido da escola</h3>
                    <p className="text-sm font-medium leading-relaxed text-amber-900">
                      Use depois que a escola demonstrar interesse. A pergunta certa é: "Quer iniciar o pedido para a equipa KLASSE avaliar a modernização da sua escola?"
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
                <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo 1</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">Criar pressão pública com portal do aluno e matrícula online.</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo 2</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">Direcionar diretores interessados para o pedido de onboarding.</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo 3</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">A equipe KLASSE faz follow-up com o contexto do resultado.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="crm" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Leads header with Button */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">CRM Pré-Vendas</p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Leads Comerciais</h2>
              </div>
              <Button
                onClick={() => setCrmModalOpen(true)}
                className="bg-klasse-gold hover:bg-klasse-gold/90 text-slate-950 font-bold text-xs uppercase tracking-widest px-5 py-3 h-auto rounded-xl border-none shadow-sm flex items-center gap-1.5"
              >
                <Plus size={16} />
                Novo Lead
              </Button>
            </div>

            {/* Leads metrics grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      <Target size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leads Ativos</p>
                      <p className="text-3xl font-black text-slate-900">{totalCrmLeadsCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Em Prospecção</p>
                      <p className="text-3xl font-black text-blue-600">{newCrmLeadsCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
                      <School size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto & Demo</p>
                      <p className="text-3xl font-black text-purple-600">{inContactCrmCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Em Negociação</p>
                      <p className="text-3xl font-black text-amber-600">{negotiatingCrmCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolas captadas</p>
                      <p className="text-3xl font-black text-slate-900">{onboardingStats?.total ?? stats?.total_diagnosticos}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Novos interessados</p>
                      <p className="text-3xl font-black text-blue-600">{onboardingStats?.pendentes ?? stats?.novos}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Em contacto</p>
                      <p className="text-3xl font-black text-amber-600">{onboardingStats?.em_configuracao ?? stats?.em_contacto}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-klasse-green/20 bg-klasse-green/5 shadow-sm overflow-hidden border-2">
                  <CardContent className="p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-klasse-green flex items-center justify-center text-white">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-klasse-green/60 uppercase tracking-widest">Escolas fechadas</p>
                      <p className="text-3xl font-black text-klasse-green">{onboardingStats?.fechadas ?? stats?.convertidos}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

            {/* Funil de Vendas (CRM Leads) rendering */}
            {pipelineMode === 'leads' && (
              <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                <CardHeader className="p-8 pb-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">CRM Pré-Vendas</p>
                  <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Negociações Comerciais Ativas</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Cadastre e faça a prospecção ativa de escolas antes do onboarding técnico. Arraste e clique para gerenciar ações de follow-up.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  {/* Pipeline Value summary */}
                  {activeCrmLeads.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {memberRole === 'owner' ? (
                        <>
                          <div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Potencial de Receita Comercial</p>
                            <p className="text-xl font-black text-klasse-gold">
                              Kz {totalCrmPipelineValue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="text-xs text-slate-400 max-w-md font-medium">
                            Comissão potencial calculada com base na conversão de todos os leads ativos (25% do valor da mensalidade estimativa).
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Negociações em Curso</p>
                            <p className="text-xl font-black text-[#10b981]">
                              {activeCrmLeads.length} {activeCrmLeads.length === 1 ? 'Lead Ativo' : 'Leads Ativos'}
                            </p>
                          </div>
                          <div className="text-xs text-slate-400 max-w-md font-medium">
                            Foque em agendar apresentações e fazer contatos regulares para qualificar e converter seus leads.
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* CRM leads representation */}
                  {crmLeads.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-20 text-center">
                      <Target className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                      <p className="text-sm font-bold text-slate-500">Nenhum lead comercial de pré-vendas cadastrado.</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Adicione o seu primeiro lead comercial para começar o pipeline de vendas.</p>
                      <Button onClick={() => setCrmModalOpen(true)} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 h-10 rounded-xl hover:bg-slate-800 border-none">
                        Cadastrar Primeiro Lead
                      </Button>
                    </div>
                  ) : viewMode === 'kanban' ? (
                    <div className="flex gap-4 overflow-x-auto pb-6 w-full scrollbar-thin">
                      {Object.entries(CRM_STAGES).map(([stageCode, stageMeta]) => {
                        const leadsInStage = crmLeads.filter(l => l.etapa === stageCode);
                        return (
                          <div key={stageCode} className="w-72 shrink-0 flex flex-col gap-3">
                            <div className="flex items-center justify-between px-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{stageMeta.label}</span>
                                <span className="bg-slate-100 text-slate-600 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200/50">
                                  {leadsInStage.length}
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-2.5 p-2 rounded-2xl bg-slate-50 border border-slate-200/60 min-h-[450px]">
                              {leadsInStage.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-300">
                                  <p className="text-[9px] font-bold uppercase tracking-wider">Sem Leads</p>
                                </div>
                              ) : (
                                leadsInStage.map((lead) => {
                                  const isLeadOverdue = lead.proxima_acao_data && new Date(lead.proxima_acao_data).getTime() < Date.now();
                                  let delayDays = 0;
                                  if (isLeadOverdue && lead.proxima_acao_data) {
                                    const diffTime = Date.now() - new Date(lead.proxima_acao_data).getTime();
                                    delayDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                                  }

                                  return (
                                    <div
                                      key={lead.id}
                                      onClick={() => handleOpenLeadDrawer(lead)}
                                      className={`group relative rounded-xl border p-4 shadow-sm bg-white hover:shadow-md transition-all flex flex-col gap-2.5 cursor-pointer ${
                                        isLeadOverdue ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="font-black text-slate-900 text-xs truncate" title={lead.nome_escola}>
                                            {lead.nome_escola}
                                          </p>
                                          {isLeadOverdue && (
                                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-100 text-rose-700 animate-pulse">
                                              {delayDays === 1 ? '1d atrasado' : `${delayDays}d atrasado`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                          <span className="truncate max-w-[120px]">Contato: {lead.nome_contacto || "Não informado"}</span>
                                          {lead.alunos_estimados > 0 && <span>{lead.alunos_estimados} al.</span>}
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-1.5 border-t border-slate-50 pt-2 text-[9px] font-medium text-slate-500">
                                        <div className="flex justify-between items-center">
                                          <span>Plano: {lead.plano_estimado}</span>
                                          {memberRole === 'owner' && (
                                            <span className="font-bold text-emerald-600">
                                              Kz {getCommissionForPlan(lead.plano_estimado).toLocaleString('pt-PT')}
                                            </span>
                                          )}
                                        </div>

                                        {lead.proxima_acao ? (
                                          <div className={`mt-1 flex items-start gap-1 p-1.5 rounded-lg border ${
                                            isLeadOverdue ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                                          }`}>
                                            <Clock size={10} className="mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                              <p className="font-bold truncate text-[8px] uppercase tracking-wider">Ação: {lead.proxima_acao}</p>
                                              {lead.proxima_acao_data && (
                                                <p className="text-[8px] mt-0.5">Prazo: {format(new Date(lead.proxima_acao_data), "dd/MM/yyyy")}</p>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="mt-1 flex items-center gap-1 p-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
                                            <FileQuestion size={10} />
                                            <span className="text-[8px] font-bold uppercase tracking-wider">Sem próxima ação definida</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {crmLeads.map((lead) => {
                        const isLeadOverdue = lead.proxima_acao_data && new Date(lead.proxima_acao_data).getTime() < Date.now();
                        const stageMeta = CRM_STAGES[lead.etapa as keyof typeof CRM_STAGES] || CRM_STAGES.prospeccao;
                        return (
                          <div
                            key={lead.id}
                            onClick={() => handleOpenLeadDrawer(lead)}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate font-black text-slate-900">{lead.nome_escola}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                  <span>Cadastrado em: {format(new Date(lead.created_at), "dd MMM, HH:mm", { locale: pt })}</span>
                                  {lead.alunos_estimados > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>{lead.alunos_estimados} alunos</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isLeadOverdue && (
                                  <Badge className="bg-rose-100 text-rose-700 border-none font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg animate-pulse">
                                    Ação Atrasada
                                  </Badge>
                                )}
                                <Badge className="border border-slate-200 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-700">
                                  Plano: {lead.plano_estimado}
                                </Badge>
                                <Badge className={`${stageMeta.color} border-none font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${stageMeta.dot} mr-2`} />
                                  {stageMeta.label}
                                </Badge>
                              </div>
                            </div>

                            {lead.proxima_acao && (
                              <div className="mt-1 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
                                <p className="truncate">
                                  Próximo Passo: <span className="font-bold text-slate-800">{lead.proxima_acao}</span>
                                  {lead.proxima_acao_data && (
                                    <span className="text-slate-400 font-medium"> (até {format(new Date(lead.proxima_acao_data), "dd/MM/yyyy")})</span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="onboarding" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Onboarding Header */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Processo de Ativação</p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Ativação Escolar</h2>
              </div>
            </div>

            {/* Onboarding metrics grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolas captadas</p>
                    <p className="text-3xl font-black text-slate-900">{onboardingStats?.total ?? stats?.total_diagnosticos}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Novos interessados</p>
                    <p className="text-3xl font-black text-blue-600">{onboardingStats?.pendentes ?? stats?.novos}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Em ativação</p>
                    <p className="text-3xl font-black text-amber-600">{onboardingStats?.em_configuracao ?? stats?.em_contacto}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-klasse-green/20 bg-klasse-green/5 shadow-sm overflow-hidden border-2">
                <CardContent className="p-6 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-klasse-green flex items-center justify-center text-white">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-klasse-green/60 uppercase tracking-widest">Escolas fechadas</p>
                    <p className="text-3xl font-black text-klasse-green">{onboardingStats?.fechadas ?? stats?.convertidos}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Funil de Ativação (Onboarding) rendering */}
            {onboardingStats && (
              <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                <CardHeader className="p-8 pb-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pedido de escolas</p>
                  <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Escolas que usaram o seu código</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    A equipa KLASSE faz o contacto comercial. Aqui você acompanha plano escolhido e avanço do funil.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  {/* Responsabilidade de Etapas Pendentes */}
                  {schoolsList.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ações com Escola</p>
                          <p className="text-lg font-black text-slate-900">{pendingStepsStats['Escola'] || 0}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ações com Parceiro</p>
                          <p className="text-lg font-black text-slate-900">{pendingStepsStats['Parceiro'] || 0}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ações com KLASSE</p>
                          <p className="text-lg font-black text-slate-900">{pendingStepsStats['KLASSE'] || 0}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pendências por etapa</p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{Object.keys(pendingStepCodeStats).length} etapa(s)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(pendingStepCodeStats)
                            .sort((a, b) => b[1] - a[1])
                            .map(([code, total]) => (
                              <Badge key={code} className="bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] px-2.5 py-1 rounded-lg">
                                {getStepMeta(code, 'escola').short}: {total}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filters Bar */}
                  {schoolsList.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        <button
                          onClick={() => setOnboardingFilter('todos')}
                          className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                            onboardingFilter === 'todos'
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                          }`}
                        >
                          Todos ({countTodos})
                        </button>
                        <button
                          onClick={() => setOnboardingFilter('pendente')}
                          className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                            onboardingFilter === 'pendente'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                          }`}
                        >
                          Pendentes ({countPendente})
                        </button>
                        <button
                          onClick={() => setOnboardingFilter('atrasado')}
                          className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                            onboardingFilter === 'atrasado'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                          }`}
                        >
                          Atrasados ({countAtrasado})
                        </button>
                        <button
                          onClick={() => setOnboardingFilter('concluido')}
                          className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                            onboardingFilter === 'concluido'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                          }`}
                        >
                          Concluídos ({countConcluido})
                        </button>
                      </div>

                      {/* Alternador de Visualização (Lista vs Kanban) */}
                      <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        <button
                          type="button"
                          onClick={() => setViewMode('lista')}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                            viewMode === 'lista'
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <List size={14} />
                          Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('kanban')}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                            viewMode === 'kanban'
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-950'
                          }`}
                        >
                          <LayoutGrid size={14} />
                          CRM / Kanban
                        </button>
                      </div>
                    </div>
                  )}

                  {filteredSchools.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                      <School className="mx-auto mb-4 h-10 w-10 text-slate-300" />
                      <p className="text-sm font-bold text-slate-400">Nenhum pedido de escola nesta categoria.</p>
                    </div>
                  ) : viewMode === 'kanban' ? (
                    <div className="flex gap-4 overflow-x-auto pb-6 w-full scrollbar-thin">
                      {Object.entries(STEP_META).map(([stepCode, meta]) => {
                        const schoolsInStep = filteredSchools.filter(escola => {
                          const nextPending = escola.steps?.find(st => st.status !== 'concluido');
                          if (stepCode === 'live') {
                            return !nextPending || escola.status === 'activo';
                          }
                          return nextPending?.code === stepCode && escola.status !== 'activo';
                        });

                        return (
                          <div key={stepCode} className="w-72 shrink-0 flex flex-col gap-3">
                            <div className="flex items-center justify-between px-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{meta.short}</span>
                                <span className="bg-slate-100 text-slate-600 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200/50">
                                  {schoolsInStep.length}
                                </span>
                              </div>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{meta.ownerLabel}</span>
                            </div>

                            <div className="flex-1 flex flex-col gap-2.5 p-2 rounded-2xl bg-slate-50 border border-slate-200/60 min-h-[450px]">
                              {schoolsInStep.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-300">
                                  <p className="text-[9px] font-bold uppercase tracking-wider">Coluna Vazia</p>
                                </div>
                              ) : (
                                schoolsInStep.map((escola, escIdx) => {
                                   const isSchoolOverdue = escola.steps?.some(st => st.status !== 'concluido' && st.deadline && new Date(st.deadline).getTime() < Date.now()) ?? false;
                                   const nextPending = escola.steps?.find(st => st.status !== 'concluido');
                                   
                                   let delayDays = 0;
                                   if (nextPending && nextPending.deadline) {
                                     const deadlineTime = new Date(nextPending.deadline).getTime();
                                     if (deadlineTime < Date.now()) {
                                       const diffTime = Date.now() - deadlineTime;
                                       delayDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                                     }
                                   }

                                   return (
                                     <div 
                                       key={`${escola.escola}-${escIdx}`} 
                                       onClick={() => {
                                         setSelectedSchoolForDetails(escola);
                                         setDetailsDrawerOpen(true);
                                       }}
                                       className={`group relative rounded-xl border p-4 shadow-sm bg-white hover:shadow-md transition-all flex flex-col gap-2.5 cursor-pointer ${
                                         isSchoolOverdue ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
                                       }`}
                                     >
                                       <div className="flex flex-col gap-1">
                                         <div className="flex items-start justify-between gap-2">
                                           <p className="font-black text-slate-900 text-xs truncate" title={escola.escola}>
                                             {escola.escola}
                                           </p>
                                           {isSchoolOverdue && (
                                             <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-100 text-rose-700 animate-pulse">
                                               {delayDays === 1 ? '1d atraso' : `${delayDays}d atraso`}
                                             </span>
                                           )}
                                         </div>
                                         <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                           <span className="truncate max-w-[120px]">Plano: {escola.plano_label || escola.plano || "N/I"}</span>
                                           {escola.total_alunos && <span>{escola.total_alunos} al.</span>}
                                         </div>
                                       </div>

                                       {escola.steps && escola.steps.length > 0 && (
                                         <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-2">
                                           <div className="flex items-center gap-0.5">
                                             {escola.steps.map((st, sIdx) => {
                                               const isDone = st.status === 'concluido';
                                               const isProg = st.status === 'em_progresso';
                                               const deadlineTime = st.deadline ? new Date(st.deadline).getTime() : 0;
                                               const isOverdue = !isDone && deadlineTime > 0 && deadlineTime < Date.now();
                                               const isDueSoon = !isDone && !isOverdue && deadlineTime > 0 && (deadlineTime - Date.now()) <= 24 * 60 * 60 * 1000;
                                               const meta = getStepMeta(st.code, st.owner);
                                               return (
                                                 <span 
                                                   key={sIdx} 
                                                   title={`${meta.short}: ${st.status === 'concluido' ? 'Concluído' : st.status === 'em_progresso' ? 'Em Progresso' : 'Pendente'} (Responsabilidade: ${meta.ownerLabel})`}
                                                   className={`w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white transition-all
                                                     ${isDone ? 'bg-[#1F6B3B]' : isOverdue ? 'bg-red-500 animate-pulse' : isDueSoon ? 'bg-amber-500 animate-pulse' : isProg ? 'bg-blue-500' : 'bg-slate-200'}`}
                                                 >
                                                   {isDone ? '✓' : ''}
                                                 </span>
                                               );
                                             })}
                                           </div>
                                           <span className="text-[8px] font-bold text-slate-400">
                                             ({escola.steps.filter(s => s.status === 'concluido').length}/{escola.steps.length})
                                           </span>
                                         </div>
                                       )}

                                       <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5">
                                         <span className="text-[9px] font-bold text-slate-400">
                                           {format(new Date(escola.data), "dd MMM", { locale: pt })}
                                         </span>
                                         <div className="flex items-center gap-1.5">
                                           {escola.status !== 'activo' && (
                                             <button
                                               type="button"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 const nextPending = escola.steps?.find(st => st.status !== 'concluido');
                                                 setSelectedSchoolForCall(escola);
                                                 setSelectedStepCodeForCall(nextPending?.code || "");
                                                 setCallModalOpen(true);
                                               }}
                                               className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-950 transition-colors"
                                               title="Registrar Ligação"
                                             >
                                               <Phone size={10} />
                                             </button>
                                           )}
                                           {escola.token && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${escola.token}` : '';
                                                    copyToClipboard(trackingUrl);
                                                  }}
                                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-950 transition-colors"
                                                  title="Copiar Link de Acompanhamento"
                                                >
                                                  <Copy size={10} />
                                                </button>
                                                <a
                                                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                                    `Olá! Acompanhe o processo de ativação da sua escola (${escola.escola}) em tempo real no nosso Portal de Ativação. Por lá, você poderá enviar documentos e planilhas pendentes, além de acompanhar o prazo de cada etapa.\n\nLink de acesso seguro: ${typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${escola.token}` : ''}`
                                                  )}${
                                                    escola.director_tel || escola.escola_tel
                                                      ? `&phone=${(escola.director_tel || escola.escola_tel || '').replace(/\D/g, '')}`
                                                      : ''
                                                  }`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[#1F6B3B] hover:text-[#1F6B3B]/80 transition-colors flex items-center justify-center"
                                                  title="Compartilhar no WhatsApp"
                                                >
                                                  <Send size={10} />
                                                </a>
                                                <Link
                                                  href={`/onboarding/acompanhar/${escola.token}`}
                                                  target="_blank"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[#1F6B3B] hover:text-[#1F6B3B]/80 transition-colors"
                                                  title="Ver página pública de acompanhamento"
                                                >
                                                  <Clock size={10} />
                                                </Link>
                                              </>
                                            )}
                                         </div>
                                       </div>
                                     </div>
                                   );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredSchools.map((escola, idx) => {
                        const status = ONBOARDING_STATUS_CONFIG[escola.status as keyof typeof ONBOARDING_STATUS_CONFIG] || ONBOARDING_STATUS_CONFIG.pendente;
                        const nextPendingStep = escola.steps?.find(step => step.status !== 'concluido') ?? null;
                        const isSchoolOverdue = escola.steps?.some(st => st.status !== 'concluido' && st.deadline && new Date(st.deadline).getTime() < Date.now()) ?? false;
                        
                        return (
                          <div 
                            key={`${escola.escola}-${idx}`} 
                            onClick={() => {
                              setSelectedSchoolForDetails(escola);
                              setDetailsDrawerOpen(true);
                            }}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate font-black text-slate-900">{escola.escola}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                  <span>{format(new Date(escola.data), "dd MMM, HH:mm", { locale: pt })}</span>
                                  {escola.total_alunos && (
                                    <>
                                      <span>•</span>
                                      <span>{escola.total_alunos} alunos</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isSchoolOverdue && (
                                  <Badge className="bg-rose-100 text-rose-700 border-none font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg animate-pulse">
                                    Atrasado (SLA)
                                  </Badge>
                                )}
                                <Badge className="border border-klasse-gold-200 bg-klasse-gold-100 text-[9px] font-black uppercase tracking-widest text-klasse-gold-700">
                                  Plano: {escola.plano_label || escola.plano || "Não informado"}
                                </Badge>
                                <Badge className={`${status.color} border-none font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg`}>
                                  <span className={`w-1 h-1 rounded-full ${status.dot} mr-2`} />
                                  {status.label}
                                </Badge>
                              </div>
                            </div>

                            {/* Detailed Onboarding Step checklist progress & link */}
                            {escola.steps && escola.steps.length > 0 && (
                              <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-bold">Workflow 7 etapas:</span>
                                    <div className="flex items-center gap-1">
                                      {escola.steps.map((st, sIdx) => {
                                        const isDone = st.status === 'concluido';
                                        const isProg = st.status === 'em_progresso';
                                        const deadlineTime = st.deadline ? new Date(st.deadline).getTime() : 0;
                                        const isOverdue = !isDone && deadlineTime > 0 && deadlineTime < Date.now();
                                        const isDueSoon = !isDone && !isOverdue && deadlineTime > 0 && (deadlineTime - Date.now()) <= 24 * 60 * 60 * 1000;
                                        const meta = getStepMeta(st.code, st.owner);
                                        return (
                                          <span 
                                            key={sIdx} 
                                            title={`${meta.short}: ${st.status === 'concluido' ? 'Concluído' : st.status === 'em_progresso' ? 'Em Progresso' : 'Pendente'} (Responsabilidade: ${meta.ownerLabel})`}
                                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white transition-all
                                              ${isDone ? 'bg-[#1F6B3B]' : isOverdue ? 'bg-red-500 animate-pulse' : isDueSoon ? 'bg-amber-500 animate-pulse' : isProg ? 'bg-blue-500' : 'bg-slate-200'}`}
                                          >
                                            {isDone ? '✓' : ''}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-bold ml-1">
                                      ({escola.steps.filter(s => s.status === 'concluido').length}/{escola.steps.length})
                                    </span>
                                  </div>
                                  {nextPendingStep ? (
                                    <p className="text-[11px] font-medium text-slate-600">
                                      Próxima fase: <span className="font-black text-slate-900">{getStepMeta(nextPendingStep.code, nextPendingStep.owner).short}</span>
                                      {" · "}
                                      <span className="text-slate-500">Responsável: {getStepMeta(nextPendingStep.code, nextPendingStep.owner).ownerLabel}</span>
                                    </p>
                                  ) : (
                                    <p className="text-[11px] font-medium text-emerald-700">
                                      Workflow completo. Escola pronta para go-live.
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                                  {nextPendingStep ? (
                                    <Badge className="border border-slate-200 bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-700">
                                      Em curso: {getStepMeta(nextPendingStep.code, nextPendingStep.owner).short}
                                    </Badge>
                                  ) : (
                                    <Badge className="border border-emerald-200 bg-emerald-100 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                                      Go-live pronto
                                    </Badge>
                                  )}
                                  {escola.status !== 'activo' && (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSchoolForCall(escola);
                                        setSelectedStepCodeForCall(nextPendingStep?.code || "");
                                        setCallModalOpen(true);
                                      }}
                                      className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
                                    >
                                      <Phone size={12} className="text-slate-400" />
                                      REGISTRAR LIGAÇÃO
                                    </Button>
                                  )}
                                  {escola.token && (
                                    <>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${escola.token}` : '';
                                          copyToClipboard(trackingUrl);
                                        }}
                                        className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
                                      >
                                        <Copy size={12} className="text-slate-400" />
                                        COPIAR LINK
                                      </Button>
                                      <a
                                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                          `Olá! Acompanhe o processo de ativação da sua escola (${escola.escola}) em tempo real no nosso Portal de Ativação. Por lá, você poderá enviar documentos e planilhas pendentes, além de acompanhar o prazo de cada etapa.\n\nLink de acesso seguro: ${typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${escola.token}` : ''}`
                                        )}${
                                          escola.director_tel || escola.escola_tel
                                            ? `&phone=${(escola.director_tel || escola.escola_tel || '').replace(/\D/g, '')}`
                                            : ''
                                        }`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 rounded-xl bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 px-3 text-[10px] font-black text-white flex items-center justify-center gap-1.5 shadow-none no-underline"
                                      >
                                        <Send size={12} /> WHATSAPP
                                      </a>
                                      <Link 
                                        href={`/onboarding/acompanhar/${escola.token}`}
                                        target="_blank"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[10px] font-bold text-[#1F6B3B] hover:underline flex items-center gap-1 no-underline ml-1"
                                      >
                                        <Clock size={12} /> Ver Página Pública →
                                      </Link>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Trend Chart */}
            <Card className="rounded-[32px] border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tendência de Crescimento</p>
                  <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Diagnósticos concluídos (últimos 7 dias)</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-klasse-gold animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Live Update</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-8 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.trend || []}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E3B23C" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#E3B23C" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="dia" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis hide domain={[0, 'auto']} />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                      cursor={{ stroke: '#E3B23C', strokeWidth: 2, strokeDasharray: '4 4' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#E3B23C" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorTotal)" 
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Recent Activity */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Atividade Pública</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Últimos 50 diagnósticos</span>
                </div>
                
                <div className="space-y-3">
                  {stats?.leads.length === 0 ? (
                    <div className="p-20 text-center bg-white border border-slate-200 rounded-[32px]">
                      <Users className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 font-medium italic">Ainda não há diagnósticos concluídos com este código.</p>
                    </div>
                  ) : (
                    stats?.leads.map((lead, idx) => {
                      const status = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOVO;
                      return (
                        <div key={idx} className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                              {lead.escola_hint.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{lead.escola_hint}</p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                <span>{format(new Date(lead.data), "dd MMM, HH:mm", { locale: pt })}</span>
                                <span>•</span>
                                <span>Score: {lead.score}/20</span>
                              </div>
                            </div>
                          </div>
                          <Badge className={`${status.color} border-none font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg`}>
                            <span className={`w-1 h-1 rounded-full ${status.dot} mr-2`} />
                            {status.label}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Tips & Commission */}
              <div className="space-y-6">
                {memberRole === 'owner' && (
                  <Card className="rounded-[32px] border-slate-900 bg-slate-900 text-white shadow-xl">
                    <CardHeader className="p-6">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="text-klasse-gold" />
                        Sua Comissão
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Ganhe 25% do valor da primeira mensalidade paga por cada escola ativada.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 space-y-5">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Acumulado (Ativo)</p>
                        <p className="text-2xl font-black text-klasse-gold">
                          {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalComissao).replace('AOA', 'Kz')}
                        </p>
                      </div>

                      {/* Simulação interactiva de comissão */}
                      <div className="pt-4 border-t border-white/10 space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Simulador de Ganhos</h4>
                        
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase">Plano da Escola</label>
                          <div className="grid grid-cols-3 gap-1.5 bg-white/5 p-1 rounded-xl">
                            {(['essencial', 'profissional', 'premium'] as const).map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setCalcPlan(p)}
                                className={`py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all
                                  ${calcPlan === p ? 'bg-klasse-gold text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                            <span>Nº de Alunos</span>
                            <span className="text-white font-black">{calcAlunos}</span>
                          </div>
                          <input 
                            type="range" 
                            min="100" 
                            max="2000" 
                            step="50"
                            value={calcAlunos} 
                            onChange={e => setCalcAlunos(parseInt(e.target.value))}
                            className="w-full accent-klasse-gold bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                          />
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400">Comissão Prevista:</span>
                          <span className="font-black text-klasse-gold">
                            {(() => {
                              let basePrice = 80000;
                              if (calcPlan === 'profissional') basePrice = 140000;
                              if (calcPlan === 'premium') basePrice = 250000;
                              const value = basePrice * 0.25;
                              return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value).replace('AOA', 'Kz');
                            })()}
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 italic">Os pagamentos são processados entre o dia 1 e 5 de cada mês.</p>
                    </CardContent>
                  </Card>
                )}

                <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <Zap size={20} fill="currentColor" />
                  </div>
                  <h4 className="font-bold text-amber-900">Dica de Ouro</h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Escolas com <strong>Score abaixo de 10</strong> são as mais fáceis de converter. 
                    Elas têm "makas" urgentes de desorganização que o KLASSE resolve em 24 horas.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="materiais" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assets.map((asset) => (
                <Card key={asset.id} className="rounded-3xl border-slate-200 overflow-hidden bg-white shadow-sm flex flex-col">
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100">
                        {asset.tipo === 'image' && <ImageIcon size={18} />}
                        {asset.tipo === 'video' && <Video size={18} />}
                        {asset.tipo === 'script' && <FileText size={18} />}
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest">{asset.tipo}</Badge>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{asset.titulo}</h4>
                      {asset.descricao && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{asset.descricao}</p>}
                    </div>
                    {asset.tipo === 'script' && asset.conteudo && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 font-medium italic relative group">
                        "{asset.conteudo}"
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    {asset.tipo === 'script' ? (
                      <Button 
                        onClick={() => copyToClipboard(asset.conteudo!)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs gap-2 border-none h-10"
                      >
                        <Copy size={14} />
                        COPIAR TEXTO
                      </Button>
                    ) : (
                      <Button 
                        asChild
                        className="w-full bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl font-bold text-xs gap-2 h-10"
                      >
                        <a href={asset.url || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full h-full no-underline">
                          {asset.tipo === 'image' ? <Download size={14} /> : <ArrowRight size={14} />}
                          {asset.tipo === 'image' ? 'DESCARREGAR' : 'ABRIR LINK'}
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              {assets.length === 0 && (
                <div className="col-span-full p-20 text-center bg-white border border-dashed border-slate-200 rounded-[32px]">
                   <p className="text-slate-400 font-medium italic">Nenhum material disponível de momento.</p>
                </div>
              )}
            </div>

            {/* Modelos de Planilhas e Importação */}
            <div className="space-y-4 pt-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Modelos de Planilhas para Onboarding</h3>
                <p className="text-xs text-slate-500 font-medium">Use estes modelos para ajudar as escolas indicadas a estruturarem os dados de alunos e professores antes da carga técnica.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-slate-200 overflow-hidden bg-white shadow-sm flex flex-col p-6 space-y-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                        <FileSpreadsheet size={18} />
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-100">Alunos</Badge>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Planilha de Carga de Alunos</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Modelo padrão contendo colunas obrigatórias como Nome Completo, Gênero, Data de Nascimento, BI e NIF.</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button 
                      asChild
                      className="w-full bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white rounded-xl font-bold text-xs gap-2 h-10 border-none"
                    >
                      <a href="/templates/modelo_alunos.csv" download="modelo_importacao_alunos.csv" className="flex items-center justify-center w-full h-full no-underline">
                        <Download size={14} />
                        BAIXAR MODELO
                      </a>
                    </Button>
                  </div>
                </Card>

                <Card className="rounded-3xl border-slate-200 overflow-hidden bg-white shadow-sm flex flex-col p-6 space-y-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                        <FileSpreadsheet size={18} />
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-purple-50 text-purple-700 border-purple-100">Professores</Badge>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Planilha de Carga de Professores</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Modelo padrão para mapeamento do corpo docente, qualificações e disciplinas que lecionam.</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button 
                      asChild
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs gap-2 h-10 border-none"
                    >
                      <a href="/templates/modelo_professores.csv" download="modelo_importacao_professores.csv" className="flex items-center justify-center w-full h-full no-underline">
                        <Download size={14} />
                        BAIXAR MODELO
                      </a>
                    </Button>
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid gap-4 rounded-[32px] bg-slate-900 p-8 text-center md:grid-cols-2">
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-5">
                <h4 className="text-lg font-black tracking-tight text-white">Link principal da campanha</h4>
                <div className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
                  <code className="flex-1 truncate px-4 text-left text-sm font-bold text-klasse-gold">
                    klasse.ao/escola-moderna?ref={codigo}
                  </code>
                  <Button
                    onClick={() => copyToClipboard(campaignUrl)}
                    className="h-8 rounded-xl border-none bg-white px-4 text-[10px] font-black text-slate-900 hover:bg-slate-100"
                  >
                    COPIAR
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Use em posts, stories e mensagens para pais.</p>
              </div>

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-5">
                <h4 className="text-lg font-black tracking-tight text-white">Link para diretores</h4>
                <div className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
                  <code className="flex-1 truncate px-4 text-left text-sm font-bold text-slate-300">
                    app.klasse.ao/onboarding?ref={codigo}
                  </code>
                  <Button
                    onClick={() => copyToClipboard(onboardingUrl)}
                    className="h-8 rounded-xl border-none bg-white px-4 text-[10px] font-black text-slate-900 hover:bg-slate-100"
                  >
                    COPIAR
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Use quando falar com diretores interessados.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

      {/* Modal Dialog for Registering Onboarding Call */}
      <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[32px] border-slate-200 bg-white p-8 shadow-xl">
          <DialogHeader>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Phone size={24} />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
              Registrar Ligação de Cobrança
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre os detalhes do contato telefônico feito com a escola para follow-up das etapas de onboarding.
            </DialogDescription>
          </DialogHeader>

          {selectedSchoolForCall && (
            <div className="space-y-4 my-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Escola</label>
                <p className="text-sm font-bold text-slate-900">{selectedSchoolForCall.escola}</p>
              </div>

              {selectedSchoolForCall.steps && selectedSchoolForCall.steps.length > 0 && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Referente à Etapa</label>
                  <select
                    value={selectedStepCodeForCall}
                    onChange={(e) => setSelectedStepCodeForCall(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Nenhuma etapa específica</option>
                    {selectedSchoolForCall.steps
                      .filter(st => st.status !== 'concluido')
                      .map(st => (
                        <option key={st.code} value={st.code}>
                          {getStepMeta(st.code, st.owner).short} ({getStepMeta(st.code, st.owner).ownerLabel})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Notas da Conversa</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Descreva brevemente o que foi alinhado (ex: Diretor prometeu enviar a planilha de alunos até quinta-feira)."
                  rows={4}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none placeholder-slate-400 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              onClick={() => setCallModalOpen(false)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterCall}
              disabled={savingCall || !callNotes.trim()}
              className="h-10 rounded-xl bg-slate-900 px-6 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 border-none"
            >
              {savingCall ? "A salvar..." : "Registrar Contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog for Registering a New CRM Lead */}
      <Dialog open={crmModalOpen} onOpenChange={setCrmModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[32px] border-slate-200 bg-white p-8 shadow-xl">
          <DialogHeader>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
              <Target size={24} />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
              Cadastrar Nova Escola (Lead)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Insira as informações do lead comercial para iniciar o acompanhamento de vendas no CRM da Klasse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4 max-h-[380px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3.5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nome da Escola</label>
                <input
                  type="text"
                  value={newLeadSchoolName}
                  onChange={(e) => setNewLeadSchoolName(e.target.value)}
                  placeholder="Ex: Colégio Moxi Nexas"
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Diretor / Decisor</label>
                  <input
                    type="text"
                    value={newLeadContactName}
                    onChange={(e) => setNewLeadContactName(e.target.value)}
                    placeholder="Ex: Dr. Eduardo Santos"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Telefone</label>
                  <input
                    type="text"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    placeholder="Ex: 923 000 000"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">E-mail</label>
                <input
                  type="email"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  placeholder="Ex: coordenacao@escola.com"
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Segmento</label>
                  <select
                    value={newLeadSegment}
                    onChange={(e) => setNewLeadSegment(e.target.value as any)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="privada">Privada</option>
                    <option value="publica">Pública</option>
                    <option value="comparticipada">Comparticipada</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Plano Estimado</label>
                  <select
                    value={newLeadPlan}
                    onChange={(e) => setNewLeadPlan(e.target.value as any)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alunos Estimados</label>
                  <input
                    type="number"
                    value={newLeadAlunos}
                    onChange={(e) => setNewLeadAlunos(Number(e.target.value))}
                    placeholder="Ex: 500"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Prazo da Ação</label>
                  <input
                    type="date"
                    value={newLeadActionDate}
                    onChange={(e) => setNewLeadActionDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Próxima Ação Comercial</label>
                <input
                  type="text"
                  value={newLeadAction}
                  onChange={(e) => setNewLeadAction(e.target.value)}
                  placeholder="Ex: Ligar para agendar apresentação"
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              onClick={() => setCrmModalOpen(false)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateLead}
              disabled={savingLead || !newLeadSchoolName.trim()}
              className="h-10 rounded-xl bg-slate-900 px-6 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 border-none"
            >
              {savingLead ? "A cadastrar..." : "Cadastrar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Drawer for Onboarding School Details */}
      <Sheet open={detailsDrawerOpen} onOpenChange={setDetailsDrawerOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto h-full bg-white flex flex-col gap-6 p-8 border-slate-200 shadow-2xl">
          {selectedSchoolForDetails && (
            <div className="flex flex-col gap-6 h-full">
              {/* Header */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escola em Onboarding</span>
                  <Badge className={`border-none font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-lg ${
                    selectedSchoolForDetails.status === 'activo'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedSchoolForDetails.status === 'activo' ? 'Ativo' : 'Pendente'}
                  </Badge>
                </div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight leading-tight">
                  {selectedSchoolForDetails.escola}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                    Plano: {selectedSchoolForDetails.plano_label || selectedSchoolForDetails.plano || "Não informado"}
                  </Badge>
                  {selectedSchoolForDetails.total_alunos && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                      {selectedSchoolForDetails.total_alunos} Alunos Estimados
                    </Badge>
                  )}
                  {selectedSchoolForDetails.escola_nif && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                      NIF: {selectedSchoolForDetails.escola_nif}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Share/Copy tracking link */}
              {selectedSchoolForDetails.token && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Share2 size={12} className="text-[#1F6B3B]" /> LINK DE ACOMPANHAMENTO DA ESCOLA
                    </span>
                    <Link
                      href={`/onboarding/acompanhar/${selectedSchoolForDetails.token}`}
                      target="_blank"
                      className="text-[10px] font-bold text-[#1F6B3B] hover:underline flex items-center gap-1 no-underline"
                    >
                      Ver página pública <ExternalLink size={10} />
                    </Link>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5">
                    <span className="text-xs font-mono font-medium text-slate-500 truncate flex-1 select-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : '';
                        copyToClipboard(trackingUrl);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-colors"
                      title="Copiar Link"
                    >
                      <Copy size={12} />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : '';
                        copyToClipboard(trackingUrl);
                      }}
                      className="flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 shadow-none"
                    >
                      <Copy size={12} /> COPIAR LINK
                    </Button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Acompanhe o processo de ativação da sua escola (${selectedSchoolForDetails.escola}) em tempo real no nosso Portal de Ativação. Por lá, você poderá enviar documentos e planilhas pendentes, além de acompanhar o prazo de cada etapa.\n\nLink de acesso seguro: ${typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : ''}`
                      )}${
                        selectedSchoolForDetails.director_tel || selectedSchoolForDetails.escola_tel
                          ? `&phone=${(selectedSchoolForDetails.director_tel || selectedSchoolForDetails.escola_tel || '').replace(/\D/g, '')}`
                          : ''
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-9 rounded-xl bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 px-3 text-[10px] font-black text-white flex items-center justify-center gap-1.5 shadow-none no-underline"
                    >
                      <Send size={12} /> COMPARTILHAR WHATSAPP
                    </a>
                  </div>
                </div>
              )}

              <Tabs defaultValue="progresso" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-2">
                  <TabsTrigger value="progresso" className="rounded-lg font-bold text-xs uppercase tracking-wider">
                    Progresso (SLA)
                  </TabsTrigger>
                  <TabsTrigger value="ficha" className="rounded-lg font-bold text-xs uppercase tracking-wider">
                    Ficha da Escola
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: Progresso e Etapas */}
                <TabsContent value="progresso" className="m-0 flex-1 overflow-y-auto space-y-6 pr-1 pt-2">
                  {/* Progress circular indicator */}
                  {(() => {
                    const steps = selectedSchoolForDetails.steps || [];
                    const completedSteps = steps.filter(s => s.status === 'concluido').length;
                    const progressPercent = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
                    
                    return (
                      <div className="bg-slate-950 text-white rounded-3xl p-5 shadow-lg flex items-center justify-between border border-white/5 gap-4">
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-white/10 text-klasse-gold">
                            Resumo de Ativação
                          </span>
                          <h4 className="text-sm font-black tracking-tight">Etapas concluídas</h4>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            O onboarding é composto por 7 fases oficiais síncronas.
                          </p>
                        </div>
                        
                        <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
                            <circle cx="40" cy="40" r="34" stroke="#E3B23C" strokeWidth="6" fill="transparent"
                              strokeDasharray={2 * Math.PI * 34}
                              strokeDashoffset={2 * Math.PI * 34 * (1 - progressPercent / 100)}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-base font-black text-white">{progressPercent}%</span>
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{completedSteps}/{steps.length}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Checklist of Steps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Roteiro de Ativação
                    </h4>
                    
                    <div className="space-y-3">
                      {(selectedSchoolForDetails.steps || []).map((step, index) => {
                        const isCompleted = step.status === "concluido";
                        const isProgress = step.status === "em_progresso";
                        const isOverdue = step.deadline && new Date() >= new Date(step.deadline) && !isCompleted;
                        const meta = getStepMeta(step.code, step.owner as any);

                        return (
                          <div key={step.code} className={`bg-white border rounded-2xl p-4 transition-all flex items-start gap-3.5 shadow-sm hover:shadow-md ${isProgress ? 'border-[#1F6B3B] ring-1 ring-[#1F6B3B]/10' : 'border-slate-200'}`}>
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 mt-0.5">
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs
                                ${isCompleted ? 'bg-[#E8F5EE] text-[#1F6B3B]' : isProgress ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                {isCompleted ? <Check size={14} /> : index + 1}
                              </div>
                              <div className="text-[7px] font-black uppercase text-slate-400">{meta.short}</div>
                            </div>
                            
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <h5 className="font-bold text-slate-900 text-xs truncate">{step.title}</h5>
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border
                                    ${step.owner === 'escola' ? 'bg-blue-50 text-blue-700 border-blue-100' : step.owner === 'parceiro' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                    {meta.ownerLabel}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border
                                    ${isCompleted ? 'bg-[#E8F5EE] text-[#1F6B3B] border-emerald-100' : isOverdue ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                    {isCompleted ? 'Concluído' : isOverdue ? 'Atrasado SLA' : 'No Prazo'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-semibold">
                                {step.deadline && (
                                  <span className="flex items-center gap-1.5">
                                    <Calendar size={10} /> Limite: {format(new Date(step.deadline), "dd 'de' MMMM", { locale: pt })}
                                  </span>
                                )}
                                {step.completed_at && (
                                  <span className="flex items-center gap-1.5 text-klasse-green">
                                    <CheckCircle2 size={10} /> Concluído a: {format(new Date(step.completed_at), "dd/MM/yyyy", { locale: pt })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: Ficha da Escola */}
                <TabsContent value="ficha" className="m-0 flex-1 overflow-y-auto space-y-6 pr-1 pt-2">
                  {/* Informações de Contato */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      Contatos e Responsáveis
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Diretor</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.director_nome || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Telefone Diretor</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.director_tel || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">E-mail Escola</span>
                        <span className="text-xs font-bold text-slate-800 break-all">{selectedSchoolForDetails.escola_email || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Telefone Escola</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.escola_tel || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Morada</span>
                        <span className="text-xs font-bold text-slate-800">
                          {[selectedSchoolForDetails.escola_morada, selectedSchoolForDetails.escola_municipio, selectedSchoolForDetails.escola_provincia].filter(Boolean).join(', ') || <span className="italic font-medium text-slate-400">Não informada</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fila de Uploads */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <FileText size={14} className="text-slate-400" />
                      Arquivos e Staging de Importação
                    </h4>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {!selectedSchoolForDetails.uploads || selectedSchoolForDetails.uploads.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nenhum upload realizado pela escola</p>
                        </div>
                      ) : (
                        selectedSchoolForDetails.uploads.map((up) => {
                          const meta = getStepMeta(up.step_code, up.created_by as any);
                          return (
                            <div key={up.id} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">{meta.short}</span>
                                <Badge className={`border-none font-bold uppercase text-[8px] px-2 py-0.5 rounded-md ${
                                  up.status === 'aprovado'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : up.status === 'rejeitado'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {up.status}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 font-bold">
                                <span className="truncate max-w-[200px]" title={up.file_path.split('/').pop()}>
                                  {up.file_path.split('/').pop()}
                                </span>
                                <a
                                  href={`https://<project-ref>.supabase.co/storage/v1/object/public/onboarding/${up.file_path}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-700 underline text-[9px] font-semibold"
                                >
                                  BAIXAR
                                </a>
                              </div>

                              {up.status === 'rejeitado' && up.rejection_reason && (
                                <div className="mt-1 rounded-lg bg-rose-50 border border-rose-100 p-2 text-[9px] font-semibold text-rose-700 leading-relaxed">
                                  Motivo da rejeição: {up.rejection_reason}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Timeline de Atividades */}
                  <div className="space-y-3.5 flex-grow flex flex-col min-h-0">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-400" />
                      Timeline de Atividades (SLA)
                    </h4>
                    <div className="overflow-y-auto pr-1 space-y-4 max-h-[250px]">
                      {!selectedSchoolForDetails.calls || selectedSchoolForDetails.calls.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nenhum contato registrado</p>
                        </div>
                      ) : (
                        <div className="relative pl-4 border-l border-slate-100 space-y-4 py-1 ml-2">
                          {selectedSchoolForDetails.calls.map((call) => (
                            <div key={call.id} className="relative group/timeline">
                              <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow-sm ring-4 ring-blue-50" />
                              
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-black text-slate-800">
                                    {call.member_name} realizou ligação
                                  </span>
                                  <span className="text-[9px] font-semibold text-slate-400">
                                    {format(new Date(call.realizado_em), "dd MMM, HH:mm", { locale: pt })}
                                  </span>
                                </div>
                                {call.step_title && (
                                  <Badge className="w-fit border-none bg-blue-50 text-blue-700 font-bold text-[8px] px-1.5 py-0.5 rounded">
                                    Etapa: {call.step_title}
                                  </Badge>
                                )}
                                <p className="text-xs font-medium text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100/50 leading-relaxed shadow-sm">
                                  {call.notes}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet Drawer for CRM Lead Details & Action Panel */}
      <Sheet open={crmLeadDrawerOpen} onOpenChange={setCrmLeadDrawerOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto h-full bg-white flex flex-col gap-6 p-8 border-slate-200 shadow-2xl">
          {selectedCrmLead && (
            <div className="flex flex-col gap-6 h-full">
              {/* Header details */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lead Comercial do CRM</span>
                  <Badge className={`border-none font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-lg ${
                    CRM_STAGES[selectedCrmLead.etapa as keyof typeof CRM_STAGES]?.color || "bg-slate-100"
                  }`}>
                    {CRM_STAGES[selectedCrmLead.etapa as keyof typeof CRM_STAGES]?.label || selectedCrmLead.etapa}
                  </Badge>
                </div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight leading-tight">
                  {selectedCrmLead.nome_escola}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                    Plano Estimado: {selectedCrmLead.plano_estimado}
                  </Badge>
                  {selectedCrmLead.alunos_estimados > 0 && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                      {selectedCrmLead.alunos_estimados} Alunos
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                    Segmento: {selectedCrmLead.segmento}
                  </Badge>
                </div>
              </div>

              {/* Informações Gerais do Lead */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  Informações de Contato
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Contato Decisor</span>
                    <span className="text-xs font-bold text-slate-800">{selectedCrmLead.nome_contacto || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Telefone</span>
                    <span className="text-xs font-bold text-slate-800">{selectedCrmLead.telefone || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">E-mail Comercial</span>
                    <span className="text-xs font-bold text-slate-800">{selectedCrmLead.email || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                  </div>
                </div>
              </div>

              {/* Stage Update Area */}
              <div className="space-y-3.5 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Target size={14} className="text-slate-400" />
                  Mover Etapa Comercial
                </h4>
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Selecione a Nova Etapa</label>
                      <select
                        value={selectedStageToChange}
                        onChange={(e) => setSelectedStageToChange(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                      >
                        {Object.entries(CRM_STAGES).map(([code, meta]) => (
                          <option key={code} value={code}>{meta.label}</option>
                        ))}
                      </select>
                    </div>
                    {selectedStageToChange === 'perdido' && (
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Motivo da Perda</label>
                        <input
                          type="text"
                          value={lossReasonText}
                          onChange={(e) => setLossReasonText(e.target.value)}
                          placeholder="Ex: Sem orçamento"
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleUpdateLeadStage(selectedCrmLead.id, selectedStageToChange)}
                    disabled={updatingLeadStage || (selectedStageToChange === 'perdido' && !lossReasonText.trim())}
                    className="w-full mt-2 h-9 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 border-none"
                  >
                    {updatingLeadStage ? "A atualizar..." : "Confirmar Mudança de Etapa"}
                  </Button>
                </div>
              </div>

              {/* CRM Lead Next Action & Logging */}
              <div className="space-y-3.5 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Phone size={14} className="text-slate-400" />
                  Registrar Contato & Próximo Passo
                </h4>
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Próxima Ação Comercial</label>
                      <input
                        type="text"
                        value={nextLeadAction}
                        onChange={(e) => setNextLeadAction(e.target.value)}
                        placeholder="Ex: Enviar proposta comercial"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Prazo da Ação</label>
                      <input
                        type="date"
                        value={nextLeadActionDate}
                        onChange={(e) => setNextLeadActionDate(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Notas da Ligação / Reunião</label>
                    <textarea
                      value={leadActionNotes}
                      onChange={(e) => setLeadActionNotes(e.target.value)}
                      placeholder="Descreva o que foi conversado e alinhe o próximo passo (ex: Reunião excelente com diretor, demonstrou interesse no plano profissional. Próximo passo: formalizar proposta de valores)."
                      rows={3}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none placeholder-slate-400 resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleUpdateLeadAction}
                    disabled={savingLeadAction || !nextLeadAction.trim()}
                    className="w-full h-9 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 border-none"
                  >
                    {savingLeadAction ? "A registrar..." : "Salvar Ação & Registrar Notas"}
                  </Button>
                </div>
              </div>

              {/* Lead interaction timeline logs */}
              <div className="space-y-3.5 border-t border-slate-100 pt-4 flex-1 flex flex-col min-h-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" />
                  Histórico de Interações do Lead
                </h4>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {loadingHistory ? (
                    <div className="text-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                    </div>
                  ) : leadHistory.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nenhum histórico comercial registrado</p>
                    </div>
                  ) : (
                    <div className="relative pl-4 border-l border-slate-100 space-y-4 py-1 ml-2">
                      {leadHistory.map((logItem) => {
                        const isMove = logItem.acao === 'CRM_LEAD_STAGE_MOVE';
                        return (
                          <div key={logItem.id} className="relative group/timeline">
                            <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white shadow-sm ring-4 ${
                              isMove ? 'bg-amber-400 ring-amber-50' : 'bg-blue-500 ring-blue-50'
                            }`} />
                            
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-slate-800">
                                  {isMove ? 'Etapa comercial alterada' : `${logItem.member_name} inseriu notas`}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-400">
                                  {format(new Date(logItem.created_at), "dd MMM, HH:mm", { locale: pt })}
                                </span>
                              </div>

                              {isMove ? (
                                <div className="text-xs font-semibold text-slate-600 bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl">
                                  Mapeamento de: <span className="font-bold uppercase text-[9.5px] text-slate-500">{CRM_STAGES[logItem.origem_etapa]?.label || logItem.origem_etapa}</span> ➔ <span className="font-bold uppercase text-[9.5px] text-emerald-600">{CRM_STAGES[logItem.nova_etapa]?.label || logItem.nova_etapa}</span>
                                  {logItem.motivo_perda && (
                                    <p className="mt-1 font-medium text-rose-700 bg-rose-50/50 border border-rose-100/50 p-2 rounded-lg text-[10px]">
                                      Motivo da Perda: {logItem.motivo_perda}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs font-medium text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100/50 leading-relaxed shadow-sm">
                                  {logItem.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PartnerAppShell>
  );
}
