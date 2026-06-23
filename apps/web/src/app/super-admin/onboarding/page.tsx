"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  BarChart3,
  School, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ChevronRight, 
  Search, 
  Eye,
  ShieldCheck,
  Phone,
  Mail,
  Database,
  Loader2,
  UploadCloud,
  FileText,
  Check,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface OnboardingRequest {
  id: string;
  created_at: string;
  status: 'pendente' | 'em_configuracao' | 'activo' | 'cancelado';
  escola_nome: string;
  escola_nif: string | null;
  escola_provincia: string;
  escola_tel: string;
  escola_email: string;
  director_nome: string;
  ano_letivo: string;
  faixa_propina: string | null;
  classes: any;
  turnos: any;
  turmas: any;
  financeiro: any;
  utilizadores: any;
  notas_admin: string | null;
  escola_id: string | null;
}

interface MarketingLead {
  id: string;
  created_at: string;
  nome: string;
  escola: string;
  whatsapp: string;
  email: string;
  score: number;
  respostas_json: any;
  status: string;
  afiliado_codigo?: string;
}

interface OnboardingUpload {
  id: string;
  onboarding_id: string;
  step_code: string;
  file_path: string;
  status: "pendente" | "processando" | "aprovado" | "rejeitado";
  rejection_reason: string | null;
  created_by: "escola" | "parceiro";
  criado_por_membro_id?: string | null;
  created_at: string;
  afiliado_membro?: {
    id: string;
    nome: string;
  } | null;
  author_type_label?: string;
  author_display?: string;
  onboarding_requests?: {
    escola_nome?: string | null;
    tracking_token?: string | null;
  } | null;
}

interface OnboardingStep {
  id: string;
  onboarding_id: string;
  step_code: string;
  title: string;
  status: "pendente" | "em_progresso" | "concluido";
  owner_type: "escola" | "parceiro" | "klasse";
  started_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
}

interface ExistingSchoolOption {
  id: string;
  nome: string | null;
  status: string | null;
  plano: PlanTier | null;
  cidade: string | null;
  estado: string | null;
}

// ─── Helpers Visuais ──────────────────────────────────────────────────────────
const STATUS_META = {
  pendente:       { label: "Pendente",      color: "bg-klasse-gold-100 text-klasse-gold-700 border-klasse-gold-200", dot: "bg-klasse-gold-500" },
  em_configuracao: { label: "Configuração",  color: "bg-slate-100 text-slate-700 border-slate-200",    dot: "bg-slate-500" },
  activo:         { label: "Activo",        color: "bg-klasse-green-100 text-klasse-green-700 border-klasse-green-200", dot: "bg-klasse-green-500" },
  cancelado:      { label: "Cancelado",     color: "bg-slate-100 text-slate-600 border-slate-200",  dot: "bg-slate-400" },
};

const LEAD_STATUS_META = {
  'NOVO': { label: "Novo", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  'EM_CONTACTO': { label: "Em Contacto", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  'CONVERTIDO': { label: "Convertido", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  'PERDIDO': { label: "Perdido", color: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

const PLAN_META: Record<string, { label: string; color: string }> = {
  essencial: { label: "Essencial", color: "bg-slate-100 text-slate-700 border-slate-200" },
  profissional: { label: "Profissional", color: "bg-klasse-gold-100 text-klasse-gold-700 border-klasse-gold-200" },
  premium: { label: "Premium", color: "bg-klasse-green-100 text-klasse-green-700 border-klasse-green-200" },
};

const getPlanMeta = (financeiro: any) => {
  const key = String(financeiro?.plano_interesse || "").toLowerCase();
  return PLAN_META[key] || { label: financeiro?.plano_interesse_label || "Sem plano", color: "bg-slate-100 text-slate-500 border-slate-200" };
};

const getInfluencerCode = (financeiro: any) => {
  const code = financeiro?.influencer_codigo;
  return typeof code === "string" && code.trim() ? code.trim().toUpperCase() : null;
};

const SCHOOL_STATUS_LABELS: Record<string, string> = {
  activa: "Activa",
  active: "Activa",
  activa_trial: "Activa",
  activo: "Activo",
  ativa: "Activa",
  cancelada: "Cancelada",
  cancelado: "Cancelado",
  excluida: "Excluída",
  excluido: "Excluído",
  inactive: "Inactiva",
  inactiva: "Inactiva",
  inativa: "Inactiva",
  inativo: "Inactivo",
  operacional: "Operacional",
  pendente: "Pendente",
  suspensa: "Suspensa",
  suspenso: "Suspenso",
  trial: "Trial",
};

const getSchoolStatusLabel = (status: string | null) => {
  if (!status) return "Sem status";
  const normalized = status.trim().toLowerCase();
  return SCHOOL_STATUS_LABELS[normalized] || status;
};

// ─── Lead Scoring Helper ──────────────────────────────────────────────────────
const calcEstimativa = (faixa: string | null, totalAlunos: any) => {
  const alunos = parseInt(String(totalAlunos || 0));
  if (!faixa || !alunos) return 0;
  
  const medias = {
    'ate_5k': 2500,
    '5k_15k': 10000,
    '15k_40k': 27500,
    'acima_40k': 50000
  };
  
  return (medias[faixa as keyof typeof medias] || 0) * alunos;
};

const fmtKz = (v: number) => {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(v).replace('AOA', 'Kz');
};

export default function SuperAdminOnboardingPage() {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [mLeads, setMLeads] = useState<MarketingLead[]>([]);
  const [uploads, setUploads] = useState<OnboardingUpload[]>([]);
  const [selectedRequestSteps, setSelectedRequestSteps] = useState<OnboardingStep[]>([]);
  const [loadingSelectedSteps, setLoadingSelectedSteps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('todos');
  const [uploadFilter, setUploadFilter] = useState<'todos' | OnboardingUpload["status"]>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'candidaturas' | 'leads' | 'uploads' | 'relatorios'>('candidaturas');
  const [allOnboardingSteps, setAllOnboardingSteps] = useState<any[]>([]);
  const [reviewingUpload, setReviewingUpload] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const supabase = createClient();

  // Provision modal states
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionTab, setProvisionTab] = useState<'existente' | 'nova'>('existente');
  const [existingSchools, setExistingSchools] = useState<ExistingSchoolOption[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [selectedExistingEscolaId, setSelectedExistingEscolaId] = useState('');

  // Form states for new school creation
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolNif, setNewSchoolNif] = useState('');
  const [newSchoolEndereco, setNewSchoolEndereco] = useState('');
  const [newSchoolPlano, setNewSchoolPlano] = useState<'essencial' | 'profissional' | 'premium'>('essencial');
  const [newSchoolAdminEmail, setNewSchoolAdminEmail] = useState('');
  const [newSchoolAdminTelefone, setNewSchoolAdminTelefone] = useState('');
  const [newSchoolAdminNome, setNewSchoolAdminNome] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'candidaturas') {
        let query = supabase
          .from('onboarding_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (filter !== 'todos') {
          query = query.eq('status', filter);
        }

        const { data, error } = await query;
        if (error) throw error;
        setRequests(data as OnboardingRequest[] || []);
      } else if (activeTab === 'leads') {
        let query = (supabase as any)
          .from('marketing_leads')
          .select('*')
          .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        setMLeads(data as MarketingLead[] || []);
      } else if (activeTab === 'uploads') {
        const response = await fetch('/api/super-admin/onboarding/uploads', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'Erro ao carregar uploads.');
        }
        setUploads((payload.uploads || []) as OnboardingUpload[]);
      } else if (activeTab === 'relatorios') {
        const { data: allReqs, error: reqsErr } = await supabase
          .from('onboarding_requests')
          .select('*');
        if (reqsErr) throw reqsErr;
        setRequests(allReqs as OnboardingRequest[] || []);

        const { data: allSteps, error: stepsErr } = await (supabase
          .from('onboarding_steps' as any)
          .select('id, onboarding_id, step_code, title, status, owner_type, started_at, deadline_at, completed_at, created_at') as any);
        if (stepsErr) throw stepsErr;
        setAllOnboardingSteps(allSteps || []);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, activeTab, supabase]);

  useEffect(() => {
    loadData();
    setSelectedId(null);
  }, [loadData]);

  useEffect(() => {
    async function loadSelectedRequestSteps() {
      if (activeTab !== 'candidaturas' || !selectedId) {
        setSelectedRequestSteps([]);
        return;
      }

      setLoadingSelectedSteps(true);
      try {
        const { data, error } = await (supabase
          .from('onboarding_steps' as any)
          .select('id, onboarding_id, step_code, title, status, owner_type, started_at, deadline_at, completed_at')
          .eq('onboarding_id', selectedId)
          .order('created_at', { ascending: true }) as any);

        if (error) throw error;
        setSelectedRequestSteps((data || []) as OnboardingStep[]);
      } catch (err: any) {
        toast.error("Erro ao carregar etapas do onboarding: " + err.message);
        setSelectedRequestSteps([]);
      } finally {
        setLoadingSelectedSteps(false);
      }
    }

    loadSelectedRequestSteps();
  }, [activeTab, selectedId, supabase]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const table = activeTab === 'candidaturas' ? 'onboarding_requests' : 'marketing_leads';
      const { error } = await (supabase as any)
        .from(table)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Status actualizado para ${newStatus}`);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao actualizar status: " + err.message);
    }
  };

  const reviewUpload = async (uploadId: string, status: 'aprovado' | 'rejeitado') => {
    if (status === 'rejeitado' && !rejectionReason.trim()) {
      toast.error('Informe o motivo da rejeição.');
      return;
    }

    setReviewingUpload(true);
    try {
      const response = await fetch(`/api/super-admin/onboarding/uploads/${uploadId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          rejection_reason: status === 'rejeitado' ? rejectionReason.trim() : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Erro ao rever upload.');
      }

      toast.success(status === 'aprovado' ? 'Upload aprovado com sucesso!' : 'Upload rejeitado com sucesso!');
      setRejectionReason('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao rever upload.');
    } finally {
      setReviewingUpload(false);
    }
  };

  const fetchSchools = async () => {
    setLoadingSchools(true);
    try {
      const response = await fetch('/api/super-admin/escolas/list?mode=provision-target', {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Erro ao carregar escolas.');
      }

      const schools = (payload.items || []) as ExistingSchoolOption[];
      setExistingSchools(schools);
      if (schools.length > 0) {
        setSelectedExistingEscolaId(schools[0].id);
      } else {
        setSelectedExistingEscolaId('');
      }
    } catch (err: any) {
      toast.error("Erro ao carregar escolas: " + err.message);
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleOpenProvisionModal = () => {
    if (!selectedRequest) return;
    
    // Prefill form states
    setNewSchoolName(selectedRequest.escola_nome || '');
    setNewSchoolNif(selectedRequest.escola_nif || '');
    setNewSchoolEndereco(selectedRequest.escola_provincia || '');
    
    const planKey = String(selectedRequest.financeiro?.plano_interesse || "").toLowerCase();
    const validPlan = ['essencial', 'profissional', 'premium'].includes(planKey) 
      ? (planKey as 'essencial' | 'profissional' | 'premium') 
      : 'essencial';
    setNewSchoolPlano(validPlan);
    
    setNewSchoolAdminEmail(selectedRequest.escola_email || '');
    setNewSchoolAdminTelefone(selectedRequest.escola_tel || '');
    setNewSchoolAdminNome(selectedRequest.director_nome || '');
    
    // Fetch schools list for the linking tab
    fetchSchools();
    
    setProvisionModalOpen(true);
  };

  const handleLinkAndProvision = async () => {
    if (!selectedRequest) return;
    if (!selectedExistingEscolaId) {
      toast.error("Selecione uma escola para vincular.");
      return;
    }

    setProvisioning(true);
    try {
      const response = await fetch(`/api/super-admin/onboarding/${selectedRequest.id}/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ escola_id: selectedExistingEscolaId }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.ok) {
        throw new Error(resData.error || "Erro no provisionamento.");
      }

      toast.success("Escola provisionada com sucesso!");
      setProvisionModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handleCreateAndProvision = async () => {
    if (!selectedRequest) return;
    if (!newSchoolName.trim()) {
      toast.error("Nome da escola é obrigatório.");
      return;
    }
    if (!newSchoolAdminEmail.trim()) {
      toast.error("Email do administrador é obrigatório.");
      return;
    }

    setProvisioning(true);
    try {
      const response = await fetch(`/api/super-admin/onboarding/${selectedRequest.id}/create-and-provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: newSchoolName,
          nif: newSchoolNif || null,
          endereco: newSchoolEndereco || null,
          plano: newSchoolPlano,
          admin: {
            email: newSchoolAdminEmail,
            telefone: newSchoolAdminTelefone || null,
            nome: newSchoolAdminNome || null,
            papel: 'admin',
          }
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.ok) {
        throw new Error(resData.error || "Falha ao criar e provisionar escola.");
      }

      toast.success("Escola criada e provisionada com sucesso!");
      setProvisionModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const filteredRequests = requests.filter(r => 
    r.escola_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.director_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLeads = mLeads.filter(l => 
    l.escola.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUploads = uploads.filter(upload => {
    const escolaNome = upload.onboarding_requests?.escola_nome?.toLowerCase() || '';
    const token = upload.onboarding_requests?.tracking_token?.toLowerCase() || '';
    const stepCode = upload.step_code.toLowerCase();
    const filePath = upload.file_path.toLowerCase();
    const matchesSearch =
      escolaNome.includes(searchTerm.toLowerCase()) ||
      token.includes(searchTerm.toLowerCase()) ||
      stepCode.includes(searchTerm.toLowerCase()) ||
      filePath.includes(searchTerm.toLowerCase());
    const matchesFilter = uploadFilter === 'todos' || upload.status === uploadFilter;
    return matchesSearch && matchesFilter;
  });

  const selectedRequest = requests.find(r => r.id === selectedId);
  const selectedLead = mLeads.find(l => l.id === selectedId);
  const selectedUpload = uploads.find(u => u.id === selectedId);
  const selectedExistingSchool = existingSchools.find((school) => school.id === selectedExistingEscolaId) || null;
  const pendingSelectedRequestSteps = selectedRequestSteps.filter(step => step.status !== 'concluido');
  const canProvisionSelectedRequest =
    !!selectedRequest &&
    selectedRequest.status !== 'activo' &&
    selectedRequestSteps.length > 0 &&
    pendingSelectedRequestSteps.length === 0;

  const calculateAvgTimes = () => {
    const completedSteps = allOnboardingSteps.filter(s => s.status === 'concluido' && s.completed_at && (s.started_at || s.created_at));
    const groups: Record<string, { total_time: number; count: number; title: string }> = {};

    completedSteps.forEach(s => {
      const start = new Date(s.started_at || s.created_at).getTime();
      const end = new Date(s.completed_at).getTime();
      const diffHours = (end - start) / (1000 * 60 * 60);
      if (diffHours >= 0) {
        if (!groups[s.step_code]) {
          groups[s.step_code] = { total_time: 0, count: 0, title: s.title };
        }
        groups[s.step_code].total_time += diffHours;
        groups[s.step_code].count += 1;
      }
    });

    return Object.entries(groups).map(([code, g]) => ({
      code,
      title: g.title,
      avg_hours: Math.round(g.total_time / g.count * 10) / 10,
      count: g.count,
    }));
  };

  const calculatePartnerRates = () => {
    const groups: Record<string, { total: number; active: number }> = {};

    requests.forEach(req => {
      const partnerCode = getInfluencerCode(req.financeiro) || "DIRETO";
      if (!groups[partnerCode]) {
        groups[partnerCode] = { total: 0, active: 0 };
      }
      groups[partnerCode].total += 1;
      if (req.status === 'activo') {
        groups[partnerCode].active += 1;
      }
    });

    return Object.entries(groups).map(([partner, g]) => ({
      partner,
      total: g.total,
      active: g.active,
      rate: Math.round((g.active / g.total) * 100),
    })).sort((a, b) => b.rate - a.rate);
  };

  const calculateBottlenecks = () => {
    const pendingSteps = allOnboardingSteps.filter(s => s.status !== 'concluido');
    const counts: Record<string, { pending: number; overdue: number }> = {
      escola: { pending: 0, overdue: 0 },
      parceiro: { pending: 0, overdue: 0 },
      klasse: { pending: 0, overdue: 0 },
    };

    pendingSteps.forEach(s => {
      const owner = s.owner_type.toLowerCase();
      if (counts[owner] !== undefined) {
        counts[owner].pending += 1;
        const isOverdue = s.deadline_at && new Date(s.deadline_at).getTime() < Date.now();
        if (isOverdue) {
          counts[owner].overdue += 1;
        }
      }
    });

    return Object.entries(counts).map(([owner, c]) => ({
      owner: owner === 'escola' ? 'Escola' : owner === 'parceiro' ? 'Parceiro' : 'KLASSE',
      pending: c.pending,
      overdue: c.overdue,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              <span>Super Admin</span>
              <ChevronRight size={10} />
              <span className="text-klasse-green">Gestão de Onboarding</span>
            </nav>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pipeline de Entrada</h1>
            <p className="text-sm text-slate-500 font-medium">Controlo de leads, diagnósticos e novas escolas.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Buscar escola ou nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green/30 outline-none w-64 transition-all"
              />
            </div>
            {activeTab === 'candidaturas' && (
              <select 
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider px-4 py-2 outline-none focus:ring-4 focus:ring-klasse-green/5"
              >
                <option value="todos">Todos os Status</option>
                <option value="pendente">Pendentes</option>
                <option value="em_configuracao">Em Configuração</option>
                <option value="activo">Activos</option>
              </select>
            )}
            {activeTab === 'uploads' && (
              <select
                value={uploadFilter}
                onChange={e => setUploadFilter(e.target.value as typeof uploadFilter)}
                className="bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider px-4 py-2 outline-none focus:ring-4 focus:ring-klasse-green/5"
              >
                <option value="todos">Todos os Uploads</option>
                <option value="pendente">Pendentes</option>
                <option value="processando">Processando</option>
                <option value="aprovado">Aprovados</option>
                <option value="rejeitado">Rejeitados</option>
              </select>
            )}
          </div>
        </div>

        <Tabs defaultValue="candidaturas" value={activeTab} onValueChange={(value) => setActiveTab(value as 'candidaturas' | 'leads' | 'uploads' | 'relatorios')} className="w-full">
          <TabsList className="bg-slate-200/50 p-1 rounded-xl mb-6">
            <TabsTrigger value="candidaturas" className="rounded-lg font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-klasse-green shadow-none">
              Candidaturas ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="leads" className="rounded-lg font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-klasse-green shadow-none">
              Leads Diagnóstico ({mLeads.length})
            </TabsTrigger>
            <TabsTrigger value="uploads" className="rounded-lg font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-klasse-green shadow-none">
              Uploads ({uploads.length})
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="rounded-lg font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-klasse-green shadow-none">
              Relatórios
            </TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Lista */}
            <div className={activeTab === 'relatorios' ? "lg:col-span-3 space-y-4" : "lg:col-span-2 space-y-4"}>
              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white border border-slate-200 rounded-3xl space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-klasse-green" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando dados...</p>
                </div>
              ) : (
                <>
                <TabsContent value="candidaturas" className="m-0 space-y-4">
                  {filteredRequests.length === 0 ? (
                    <div className="p-20 text-center bg-white border border-slate-200 rounded-3xl">
                      <School className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-500 font-medium">Nenhuma candidatura encontrada.</p>
                    </div>
                  ) : (
                    filteredRequests.map(req => {
                      const meta = STATUS_META[req.status] || STATUS_META.pendente;
                      const plan = getPlanMeta(req.financeiro);
                      const influencerCode = getInfluencerCode(req.financeiro);
                      return (
                        <Card 
                          key={req.id} 
                          className={`cursor-pointer transition-all hover:shadow-md border-slate-200 rounded-2xl overflow-hidden ${selectedId === req.id ? 'ring-2 ring-klasse-green border-transparent bg-klasse-green/5' : 'bg-white'}`}
                          onClick={() => setSelectedId(req.id)}
                        >
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400 uppercase">
                                  {req.escola_nome.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-bold text-slate-900">{req.escola_nome}</h3>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(req.created_at), "dd MMM, HH:mm", { locale: pt })}</span>
                                    <span className="text-slate-200">•</span>
                                    <span className="font-bold text-klasse-green">{fmtKz(calcEstimativa(req.faixa_propina, req.financeiro?.total_alunos))} /mês est.</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge className={`${plan.color} border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full`}>
                                      Plano: {plan.label}
                                    </Badge>
                                    {influencerCode && (
                                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full">
                                        Ref: {influencerCode}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Badge className={`${meta.color} font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full border`}>
                                <span className={`w-1 h-1 rounded-full ${meta.dot} mr-1.5`} />
                                {meta.label}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="leads" className="m-0 space-y-4">
                  {filteredLeads.length === 0 ? (
                    <div className="p-20 text-center bg-white border border-slate-200 rounded-3xl">
                      <BarChart3 className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-500 font-medium">Nenhum lead de diagnóstico encontrado.</p>
                    </div>
                  ) : (
                    filteredLeads.map(lead => {
                      const meta = LEAD_STATUS_META[lead.status as keyof typeof LEAD_STATUS_META] || LEAD_STATUS_META.NOVO;
                      const scoreColor = lead.score >= 15 ? 'text-emerald-600' : lead.score >= 10 ? 'text-amber-600' : 'text-rose-600';
                      return (
                        <Card 
                          key={lead.id} 
                          className={`cursor-pointer transition-all hover:shadow-md border-slate-200 rounded-2xl overflow-hidden ${selectedId === lead.id ? 'ring-2 ring-klasse-green border-transparent bg-klasse-green/5' : 'bg-white'}`}
                          onClick={() => setSelectedId(lead.id)}
                        >
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400 uppercase">
                                  {lead.escola.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-bold text-slate-900">{lead.escola}</h3>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(lead.created_at), "dd MMM, HH:mm", { locale: pt })}</span>
                                    <span className="text-slate-200">•</span>
                                    <span className={`font-black ${scoreColor}`}>Score: {lead.score}/20</span>
                                  </div>
                                </div>
                              </div>
                              <Badge className={`${meta.color} font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full border`}>
                                <span className={`w-1 h-1 rounded-full ${meta.dot} mr-1.5`} />
                                {meta.label}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="uploads" className="m-0 space-y-4">
                  {filteredUploads.length === 0 ? (
                    <div className="p-20 text-center bg-white border border-slate-200 rounded-3xl">
                      <UploadCloud className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-500 font-medium">Nenhum upload encontrado.</p>
                    </div>
                  ) : (
                    filteredUploads.map(upload => {
                      const escolaNome = upload.onboarding_requests?.escola_nome || 'Escola não identificada';
                      const token = upload.onboarding_requests?.tracking_token || 'Sem token';
                      const uploadMeta = {
                        pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
                        processando: { label: 'Processando', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
                        aprovado: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
                        rejeitado: { label: 'Rejeitado', color: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
                      }[upload.status];

                      return (
                        <Card
                          key={upload.id}
                          className={`cursor-pointer transition-all hover:shadow-md border-slate-200 rounded-2xl overflow-hidden ${selectedId === upload.id ? 'ring-2 ring-klasse-green border-transparent bg-klasse-green/5' : 'bg-white'}`}
                          onClick={() => {
                            setSelectedId(upload.id);
                            setRejectionReason(upload.rejection_reason || '');
                          }}
                        >
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                  <FileText size={20} />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-slate-900 truncate">{escolaNome}</h3>
                                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(upload.created_at), "dd MMM, HH:mm", { locale: pt })}</span>
                                    <span className="text-slate-200">•</span>
                                    <span className="font-bold uppercase">{upload.step_code}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full">
                                      {upload.author_display || (upload.created_by === 'escola' ? 'Enviado pela Escola' : 'Enviado pelo Parceiro')}
                                    </Badge>
                                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 border font-mono text-[9px] px-2.5 py-0.5 rounded-full">
                                      {token}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <Badge className={`${uploadMeta.color} font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full border`}>
                                <span className={`w-1 h-1 rounded-full ${uploadMeta.dot} mr-1.5`} />
                                {uploadMeta.label}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>
                
                <TabsContent value="relatorios" className="m-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Gargalos por Responsável */}
                    <Card className="border-slate-200 bg-white rounded-3xl p-6 shadow-sm">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <BarChart3 className="text-klasse-green w-4 h-4" />
                          Gargalos por Responsável
                        </CardTitle>
                        <CardDescription className="text-xs">Etapas pendentes/atrasadas ativas</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 space-y-4">
                        {calculateBottlenecks().map((b, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>{b.owner}</span>
                              <span>{b.pending} pendentes</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-klasse-green rounded-full" 
                                style={{ width: `${b.pending ? Math.min(100, (b.pending / (allOnboardingSteps.length || 1)) * 100) : 0}%` }}
                              />
                            </div>
                            {b.overdue > 0 && (
                              <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                ⚠️ {b.overdue} etapa{b.overdue > 1 ? 's' : ''} em atraso
                              </p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Tempo Médio por Etapa */}
                    <Card className="border-slate-200 bg-white rounded-3xl p-6 shadow-sm md:col-span-2">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Clock className="text-klasse-green w-4 h-4" />
                          Tempo Médio de Resolução (Fases Concluídas)
                        </CardTitle>
                        <CardDescription className="text-xs">Duração média entre a criação e conclusão de cada etapa</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        {calculateAvgTimes().length === 0 ? (
                          <p className="text-xs font-bold text-slate-400 text-center py-6">Sem dados de etapas concluídas ainda.</p>
                        ) : (
                          <div className="space-y-3">
                            {calculateAvgTimes().map((t, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{t.title}</p>
                                  <p className="text-[9px] text-slate-400 font-mono uppercase">{t.code}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-black text-slate-800">{t.avg_hours} horas</p>
                                  <p className="text-[9px] text-slate-400">baseado em {t.count} amostra{t.count > 1 ? 's' : ''}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Conversão por Parceiro */}
                  <Card className="border-slate-200 bg-white rounded-3xl p-6 shadow-sm">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="text-klasse-green w-4 h-4" />
                        Desempenho de Conversão por Parceiro
                      </CardTitle>
                      <CardDescription className="text-xs">Indicados convertidos em escolas ativas</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="py-3 px-4">Parceiro</th>
                              <th className="py-3 px-4 text-center">Total Indicado</th>
                              <th className="py-3 px-4 text-center">Ativos (Live)</th>
                              <th className="py-3 px-4 text-right">Taxa de Conclusão</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-xs">
                            {calculatePartnerRates().map((pr, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-bold text-slate-900">{pr.partner}</td>
                                <td className="py-3 px-4 text-center text-slate-600 font-bold">{pr.total}</td>
                                <td className="py-3 px-4 text-center text-slate-600 font-bold">{pr.active}</td>
                                <td className="py-3 px-4 text-right">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                                    pr.rate >= 75 ? 'bg-emerald-100 text-emerald-800' :
                                    pr.rate >= 40 ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-800'
                                  }`}>
                                    {pr.rate}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                </>
              )}
            </div>

            {/* Detalhes do Item Seleccionado */}
            <div className="lg:col-span-1">
              {activeTab === 'candidaturas' && selectedRequest && (
                <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-xl sticky top-24 bg-white animate-klasse-fade-in">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-bold text-slate-900">{selectedRequest.escola_nome}</CardTitle>
                      <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <CardDescription>Resumo dos dados de Onboarding</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {(() => {
                      const plan = getPlanMeta(selectedRequest.financeiro);
                      const influencerCode = getInfluencerCode(selectedRequest.financeiro);
                      return (
                        <div className="rounded-2xl border border-klasse-green-100 bg-klasse-green-50 p-4">
                          <h4 className="mb-3 text-[10px] font-bold text-klasse-green-700 uppercase tracking-widest">Contexto Comercial</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[9px] font-bold text-klasse-green-600 uppercase">Plano Escolhido</p>
                              <p className="text-sm font-black text-slate-900">{plan.label}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-klasse-green-600 uppercase">Influencer</p>
                              <p className="text-sm font-black text-slate-900">{influencerCode || "Direto"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Info Escola */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informações Fiscais</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">NIF</p>
                          <p className="text-sm font-bold text-slate-700 font-mono">{selectedRequest.escola_nif || 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Província</p>
                          <p className="text-sm font-bold text-slate-700">{selectedRequest.escola_provincia}</p>
                        </div>
                      </div>
                    </div>

                    {/* Info Director */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto do Director</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <ShieldCheck size={14} className="text-klasse-green" />
                          <span className="font-bold">{selectedRequest.director_nome}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          <span>{selectedRequest.escola_tel}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          <span className="truncate">{selectedRequest.escola_email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resumo Académico */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perfil Académico & Potencial</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Estimativa Alunos</p>
                          <p className="text-sm font-bold text-slate-700">{selectedRequest.financeiro?.total_alunos || 0}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Faturação Est.</p>
                          <p className="text-sm font-black text-[#1F6B3B]">{fmtKz(calcEstimativa(selectedRequest.faixa_propina, selectedRequest.financeiro?.total_alunos))}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prontidão para Provisionamento</h4>
                        {loadingSelectedSteps ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Carregando
                          </span>
                        ) : canProvisionSelectedRequest ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full">
                            Pronto
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full">
                            Pendente
                          </Badge>
                        )}
                      </div>

                      {selectedRequestSteps.length === 0 && !loadingSelectedSteps ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-xs font-medium text-amber-700">
                            Este pedido ainda não possui etapas carregadas. O provisionamento fica bloqueado até que o workflow esteja configurado.
                          </p>
                        </div>
                      ) : pendingSelectedRequestSteps.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-slate-500">
                            O provisionamento só será liberado quando todas as etapas estiverem concluídas.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {pendingSelectedRequestSteps.map(step => (
                              <Badge
                                key={step.id}
                                className="bg-amber-50 text-amber-700 border-amber-200 border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full"
                              >
                                {step.title}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-emerald-700">
                          Todas as etapas do onboarding estão concluídas. O pedido está elegível para provisionamento.
                        </p>
                      )}
                    </div>

                    {/* Acções de Status */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acções Administrativas</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-xl text-xs font-bold border-slate-200"
                          onClick={() => updateStatus(selectedRequest.id, 'em_configuracao')}
                          disabled={selectedRequest.status === 'em_configuracao'}
                        >
                          Mover p/ Config
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-xl text-xs font-bold border-slate-200 text-rose-600 hover:bg-rose-50"
                          onClick={() => updateStatus(selectedRequest.id, 'cancelado')}
                        >
                          Cancelar Pedido
                        </Button>
                      </div>
                      
                      <Button 
                        className="w-full bg-klasse-green hover:bg-klasse-green/90 text-white rounded-xl font-black text-sm gap-2 shadow-lg shadow-klasse-green/10"
                        onClick={handleOpenProvisionModal}
                        disabled={!canProvisionSelectedRequest}
                      >
                        <Database size={16} />
                        PROVISIONAR ESCOLA
                      </Button>
                      {!canProvisionSelectedRequest && (
                        <p className="text-xs font-medium text-amber-700 leading-relaxed">
                          Provisionamento bloqueado. Conclua todas as etapas pendentes antes de transformar este pedido em uma escola operacional.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'leads' && selectedLead && (
                <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-xl sticky top-24 bg-white animate-klasse-fade-in">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-bold text-slate-900">{selectedLead.escola}</CardTitle>
                      <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <CardDescription>Dados do Lead de Diagnóstico</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    
                    {/* Info Contacto */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto Directo</h4>
                        {selectedLead.afiliado_codigo && (
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-bold uppercase text-[9px]">
                            Ref: {selectedLead.afiliado_codigo}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <CheckCircle2 size={14} className="text-blue-500" />
                          <span className="font-bold">{selectedLead.nome}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          <span>{selectedLead.whatsapp}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          <span className="truncate">{selectedLead.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resultado Diagnóstico */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance no Diagnóstico</h4>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Score Obtido</p>
                          <p className={`text-2xl font-black ${selectedLead.score >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>{selectedLead.score}/20</p>
                        </div>
                        <Badge className={`${selectedLead.score >= 15 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'} font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full border`}>
                          {selectedLead.score >= 15 ? 'Avançado' : selectedLead.score >= 10 ? 'Intermédio' : 'Crítico'}
                        </Badge>
                      </div>
                    </div>

                    {/* Respostas Detalhadas */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mapeamento de Dores</h4>
                      <div className="grid gap-2">
                        {selectedLead.respostas_json && Object.entries(selectedLead.respostas_json).map(([key, value]: [string, any]) => (
                          <div key={key} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{key}</span>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase">{value}/4</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Acções de Follow-up */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão de Lead</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-xl text-xs font-bold border-slate-200"
                          onClick={() => updateStatus(selectedLead.id, 'EM_CONTACTO')}
                          disabled={selectedLead.status === 'EM_CONTACTO'}
                        >
                          Marcar Contacto
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-xl text-xs font-bold border-slate-200"
                          onClick={() => updateStatus(selectedLead.id, 'PERDIDO')}
                        >
                          Arquivar
                        </Button>
                      </div>
                      
                      <a 
                        href={`https://wa.me/${selectedLead.whatsapp.replace(/\D/g, '')}?text=Olá%20${selectedLead.nome},%20vi%20que%20fez%20o%20diagnóstico%20de%20gestão%20da%20escola%20${selectedLead.escola}.`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-black text-sm gap-2 shadow-lg shadow-green-500/10 h-10 flex items-center justify-center no-underline"
                      >
                        <Phone size={16} />
                        CONTACTAR VIA WHATSAPP
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'uploads' && selectedUpload && (
                <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-xl sticky top-24 bg-white animate-klasse-fade-in">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-bold text-slate-900">{selectedUpload.onboarding_requests?.escola_nome || 'Upload de onboarding'}</CardTitle>
                      <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <CardDescription>Fila de revisão documental</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Token</p>
                          <p className="font-mono font-bold text-slate-700">{selectedUpload.onboarding_requests?.tracking_token || 'Sem token'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Etapa</p>
                          <p className="font-bold text-slate-700 uppercase">{selectedUpload.step_code}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Origem</p>
                          <p className="font-bold text-slate-700">{selectedUpload.author_type_label || (selectedUpload.created_by === 'escola' ? 'Escola' : 'Parceiro')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Quem enviou</p>
                          <p className="font-bold text-slate-700">{selectedUpload.author_display || 'Não identificado'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Recebido em</p>
                          <p className="font-bold text-slate-700">{format(new Date(selectedUpload.created_at), "dd MMM yyyy, HH:mm", { locale: pt })}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Arquivo</h4>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-mono break-all text-slate-700">{selectedUpload.file_path}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motivo de rejeição</h4>
                      <textarea
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                        placeholder="Descreva por que o documento foi rejeitado..."
                        className="min-h-[110px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 outline-none transition-all focus:border-klasse-green/40 focus:ring-4 focus:ring-klasse-green/5"
                      />
                    </div>

                    {selectedUpload.rejection_reason && (
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Última rejeição</p>
                        <p className="text-sm font-medium text-rose-700">{selectedUpload.rejection_reason}</p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ações de revisão</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => reviewUpload(selectedUpload.id, 'aprovado')}
                          disabled={reviewingUpload || selectedUpload.status === 'aprovado'}
                          className="bg-klasse-green hover:bg-klasse-green/90 text-white rounded-xl font-black text-xs uppercase tracking-wider gap-2"
                        >
                          {reviewingUpload ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check size={14} />}
                          Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => reviewUpload(selectedUpload.id, 'rejeitado')}
                          disabled={reviewingUpload}
                          className="rounded-xl text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50 gap-2"
                        >
                          {reviewingUpload ? <Loader2 className="w-3 h-3 animate-spin" /> : <X size={14} />}
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!selectedId && (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-white/50">
                  <Eye size={32} className="text-slate-200 mb-2" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Seleccione um item para ver detalhes</p>
                </div>
              )}
            </div>

          </div>
        </Tabs>
      </div>

      <Dialog open={provisionModalOpen} onOpenChange={setProvisionModalOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-3xl border-slate-100 bg-white shadow-2xl p-6">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-klasse-green" />
              Provisionar Escola
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-500">
              Vincule esta candidatura de onboarding a uma escola existente ou crie uma nova escola.
            </DialogDescription>
          </DialogHeader>

          {/* Tab selectors */}
          <div className="flex bg-slate-100 p-1 rounded-xl my-4">
            <button
              onClick={() => setProvisionTab('existente')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                provisionTab === 'existente'
                  ? 'bg-white text-klasse-green shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Vincular Existente
            </button>
            <button
              onClick={() => setProvisionTab('nova')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                provisionTab === 'nova'
                  ? 'bg-white text-klasse-green shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Criar Nova Escola
            </button>
          </div>

          {provisionTab === 'existente' ? (
            <div className="space-y-4 py-2">
              {loadingSchools ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-klasse-green" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Buscando escolas...</p>
                </div>
              ) : existingSchools.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm font-medium text-slate-500">Nenhuma escola disponível encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Select
                    label="Selecione a Escola Destino"
                    id="existing-school-select"
                    value={selectedExistingEscolaId}
                    onChange={(e) => setSelectedExistingEscolaId(e.target.value)}
                    options={existingSchools.map((school) => ({
                      value: school.id,
                      label: `${school.nome || 'Escola sem nome'} • ${getSchoolStatusLabel(school.status)}`,
                    }))}
                  />
                  {selectedExistingSchool && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Escola destino</p>
                          <p className="text-sm font-black text-slate-900">{selectedExistingSchool.nome || 'Escola sem nome'}</p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full">
                          Elegível
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="font-bold uppercase tracking-widest text-slate-400">Status</p>
                          <p className="mt-1 font-semibold text-slate-700">{getSchoolStatusLabel(selectedExistingSchool.status)}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-widest text-slate-400">Plano</p>
                          <p className="mt-1 font-semibold text-slate-700">
                            {selectedExistingSchool.plano ? PLAN_NAMES[selectedExistingSchool.plano] : 'Sem plano'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="font-bold uppercase tracking-widest text-slate-400">Localização</p>
                          <p className="mt-1 font-semibold text-slate-700">
                            {[selectedExistingSchool.cidade, selectedExistingSchool.estado].filter(Boolean).join(', ') || 'Não informado'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mt-4">
                    <p className="text-xs font-medium text-amber-700 leading-relaxed">
                      <strong>Atenção:</strong> A lista acima já exclui escolas suspensas, inactivas, canceladas e excluídas. O provisionamento irá configurar ano lectivo, classes e turmas diretamente no destino escolhido.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2 max-h-[50vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nome da Escola"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="Ex: Escola Klasse"
                  required
                />
                <Input
                  label="NIF"
                  value={newSchoolNif}
                  onChange={(e) => setNewSchoolNif(e.target.value)}
                  placeholder="Ex: 500123456"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Endereço / Província"
                  value={newSchoolEndereco}
                  onChange={(e) => setNewSchoolEndereco(e.target.value)}
                  placeholder="Ex: Luanda"
                />
                <Select
                  label="Plano de Subscrição"
                  value={newSchoolPlano}
                  onChange={(e) => setNewSchoolPlano(e.target.value as any)}
                  options={[
                    { value: 'essencial', label: 'Essencial' },
                    { value: 'profissional', label: 'Profissional' },
                    { value: 'premium', label: 'Premium' },
                  ]}
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3">Administrador Principal</h4>
                <div className="space-y-4">
                  <Input
                    label="Nome do Administrador"
                    value={newSchoolAdminNome}
                    onChange={(e) => setNewSchoolAdminNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Email do Administrador"
                      type="email"
                      value={newSchoolAdminEmail}
                      onChange={(e) => setNewSchoolAdminEmail(e.target.value)}
                      placeholder="Ex: admin@escola.com"
                      required
                    />
                    <Input
                      label="Telefone do Administrador"
                      value={newSchoolAdminTelefone}
                      onChange={(e) => setNewSchoolAdminTelefone(e.target.value)}
                      placeholder="Ex: 923000000"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 pt-4 mt-6">
            <Button
              variant="outline"
              onClick={() => setProvisionModalOpen(false)}
              disabled={provisioning}
              className="rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
            {provisionTab === 'existente' ? (
              <Button
                onClick={handleLinkAndProvision}
                disabled={provisioning || loadingSchools || existingSchools.length === 0}
                className="bg-klasse-green hover:bg-klasse-green/90 text-white rounded-xl font-black text-xs uppercase tracking-wider gap-2 animate-none"
              >
                {provisioning && <Loader2 className="w-3 h-3 animate-spin" />}
                Vincular e Provisionar
              </Button>
            ) : (
              <Button
                onClick={handleCreateAndProvision}
                disabled={provisioning}
                className="bg-klasse-green hover:bg-klasse-green/90 text-white rounded-xl font-black text-xs uppercase tracking-wider gap-2 animate-none"
              >
                {provisioning && <Loader2 className="w-3 h-3 animate-spin" />}
                Criar e Provisionar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
