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
import PartnerAppShell from "@/components/layout/influencer/PartnerAppShell";
import { OnboardingSchoolDetailsSheet } from "./_components/OnboardingSchoolDetailsSheet";
import { CrmLeadDetailsSheet } from "./_components/CrmLeadDetailsSheet";
import { CampanhaTabContent } from "./_components/CampanhaTabContent";
import { EquipeTabContent } from "./_components/EquipeTabContent";
import { MateriaisTabContent } from "./_components/MateriaisTabContent";
import { SuporteTabContent } from "./_components/SuporteTabContent";
import { Escola360TabContent } from "./_components/Escola360TabContent";
import { PopsLibraryTabContent } from "./_components/PopsLibraryTabContent";

import {
  CAMPAIGN_KITS,
  COMMERCIAL_STATUS_OPTIONS,
  CRM_PLAN_OPTIONS,
  CRM_STAGES,
  DEFAULT_IMPLANTATION_CHECKLIST,
  IMPLANTATION_STATUS_CONFIG,
  MANAGEABLE_PARTNER_MEMBER_ROLES,
  ONBOARDING_STATUS_CONFIG,
  PARTNER_ROLE_LABELS,
  STATUS_CONFIG,
  WEEKLY_ACTIONS,
  getImplantationProgress,
  getLatestOnboardingCall,
  getLatestOnboardingCallForStep,
  getLeadConversionBlockers,
  getOnboardingLifecycleMeta,
  getStepMeta,
  isAfiliadoPortalResponse,
  isMarketingAsset,
  normalizeImplantationChecklist,
  type AfiliadoStats,
  type MarketingAsset,
  type OnboardingEscola,
  type OnboardingImplantationItem,
  type PartnerCommissionItem,
  type PartnerCommissionPayout,
  type PartnerCommissionSummary,
  type PartnerLoginMember,
  type PartnerMemberRole,
  type PartnerOperatorProductivity,
  type PartnerSupportCategory,
  type PartnerSupportChannel,
  type PartnerSupportSeverity,
  type PartnerSupportStatus,
  type PartnerSupportSummary,
  type PartnerSupportTicket,
  type PartnerTab,
  type PartnerTeamMember,
  type PartnerMarketingLead,
  type AfiliadoPortalResponse,
  type MarketingAssetRow,
  PARTNER_MEMBER_ROLES,
  STEP_META,
} from "./_components/partner-dashboard-model";

export default function AfiliadoDashboardPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const [stats, setStats] = useState<AfiliadoStats | null>(null);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState<PartnerMemberRole>("operator");
  const [commissionSummary, setCommissionSummary] = useState<PartnerCommissionSummary | null>(null);
  const [commissionItems, setCommissionItems] = useState<PartnerCommissionItem[]>([]);
  const [commissionPayouts, setCommissionPayouts] = useState<PartnerCommissionPayout[]>([]);
  const [payoutReceiptFile, setPayoutReceiptFile] = useState<File | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PartnerTab>('crm');
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
  const [newLeadTrialDays, setNewLeadTrialDays] = useState(15);
  const [newLeadTaxaAtivacao, setNewLeadTaxaAtivacao] = useState(50000);
  const [newLeadAction, setNewLeadAction] = useState("");
  const [newLeadActionDate, setNewLeadActionDate] = useState("");
  const [newLeadResponsavelId, setNewLeadResponsavelId] = useState("");
  const [savingLead, setSavingLead] = useState(false);
  const [marketingLeads, setMarketingLeads] = useState<PartnerMarketingLead[]>([]);
  const [selectedMarketingLeadId, setSelectedMarketingLeadId] = useState("");

  // Detail states for CRM leads (Drawer)
  const [selectedCrmLead, setSelectedCrmLead] = useState<any | null>(null);
  const [crmLeadDrawerOpen, setCrmLeadDrawerOpen] = useState(false);
  const [updatingLeadStage, setUpdatingLeadStage] = useState(false);
  const [nextLeadAction, setNextLeadAction] = useState("");
  const [nextLeadActionDate, setNextLeadActionDate] = useState("");
  const [selectedLeadResponsavelId, setSelectedLeadResponsavelId] = useState("");
  const [commercialPlan, setCommercialPlan] = useState<"essencial" | "profissional" | "premium">("essencial");
  const [commercialAlunos, setCommercialAlunos] = useState(0);
  const [commercialTrialDays, setCommercialTrialDays] = useState(15);
  const [commercialTaxaAtivacao, setCommercialTaxaAtivacao] = useState(50000);
  const [commercialMensalidade, setCommercialMensalidade] = useState(0);
  const [commercialPreset, setCommercialPreset] = useState<string>("");
  const [commercialNiveisEnsino, setCommercialNiveisEnsino] = useState<string[]>([]);
  const [commercialSecretaria, setCommercialSecretaria] = useState<{ nome?: string; email?: string; telefone?: string }>({});
  const [commercialFinanceiro, setCommercialFinanceiro] = useState<{ nome?: string; email?: string; telefone?: string }>({});
  const [commercialPedagogico, setCommercialPedagogico] = useState<{ nome?: string; email?: string; telefone?: string }>({});
  const [commercialStatus, setCommercialStatus] = useState<(typeof COMMERCIAL_STATUS_OPTIONS)[number]["value"]>("rascunho");
  const [savingCommercialTerms, setSavingCommercialTerms] = useState(false);
  const [proposalDocumentFile, setProposalDocumentFile] = useState<File | null>(null);
  const [uploadingProposalFile, setUploadingProposalFile] = useState(false);
  const [openingProposalFile, setOpeningProposalFile] = useState(false);
  const [leadActionNotes, setLeadActionNotes] = useState("");
  const [savingLeadAction, setSavingLeadAction] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);
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
  const [implantationChecklistDraft, setImplantationChecklistDraft] = useState<OnboardingImplantationItem[]>(DEFAULT_IMPLANTATION_CHECKLIST);
  const [savingImplantationChecklist, setSavingImplantationChecklist] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<PartnerTeamMember[]>([]);
  const [partnerMembers, setPartnerMembers] = useState<PartnerLoginMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [savingTeamMember, setSavingTeamMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPin, setNewMemberPin] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<(typeof MANAGEABLE_PARTNER_MEMBER_ROLES)[number]>("vendas");
  const [resetPins, setResetPins] = useState<Record<string, string>>({});
  const [supportTickets, setSupportTickets] = useState<PartnerSupportTicket[]>([]);
  const [supportSummary, setSupportSummary] = useState<PartnerSupportSummary | null>(null);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [savingSupportTicket, setSavingSupportTicket] = useState(false);
  const [newSupportSchoolToken, setNewSupportSchoolToken] = useState("");
  const [newSupportSchoolName, setNewSupportSchoolName] = useState("");
  const [newSupportTitle, setNewSupportTitle] = useState("");
  const [newSupportDescription, setNewSupportDescription] = useState("");
  const [newSupportCanal, setNewSupportCanal] = useState<PartnerSupportChannel>("whatsapp");
  const [newSupportCategoria, setNewSupportCategoria] = useState<PartnerSupportCategory>("operacional");
  const [newSupportGravidade, setNewSupportGravidade] = useState<PartnerSupportSeverity>("media");
  const [newSupportResponsavelId, setNewSupportResponsavelId] = useState("");
  const [supportUpdateNote, setSupportUpdateNote] = useState("");
  const [supportEscalationReason, setSupportEscalationReason] = useState("");

  const canManageTeam = memberRole === "owner" || memberRole === "admin";

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

  const loadCommissions = async () => {
    try {
      const response = await fetch(`/api/influencers/${codigo}/commissions`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        summary?: PartnerCommissionSummary;
        items?: PartnerCommissionItem[];
        payouts?: PartnerCommissionPayout[];
      } | null;

      if (response.ok && payload?.ok) {
        setCommissionSummary(payload.summary ?? null);
        setCommissionItems(Array.isArray(payload.items) ? payload.items : []);
        setCommissionPayouts(Array.isArray(payload.payouts) ? payload.payouts : []);
      }
    } catch (err) {
      console.error("Failed to load partner commissions:", err);
    }
  };

  const loadMarketingLeads = async () => {
    try {
      const response = await fetch(`/api/influencers/${codigo}/marketing/leads`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { ok?: boolean; leads?: PartnerMarketingLead[] } | null;
      if (response.ok && payload?.ok) {
        setMarketingLeads(Array.isArray(payload.leads) ? payload.leads : []);
      }
    } catch (err) {
      console.error("Failed to load marketing leads:", err);
    }
  };

  const approvedCommissionsAvailableForPayout = commissionItems.filter(
    (item) => item.status === "approved" && !item.payout_status
  );

  const availablePayoutKz = approvedCommissionsAvailableForPayout.reduce(
    (sum, item) => sum + Number(item.valor_kz || 0),
    0
  );

  const handleRequestPayout = async () => {
    if (approvedCommissionsAvailableForPayout.length === 0) {
      toast.error("Não há faturamentos aprovados disponíveis para payout.");
      return;
    }
    if (!payoutReceiptFile) {
      toast.error("Anexe a fatura ou recibo antes de solicitar payout.");
      return;
    }

    setRequestingPayout(true);
    try {
      const form = new FormData();
      form.set("receipt", payoutReceiptFile);
      form.set("commission_ids", JSON.stringify(approvedCommissionsAvailableForPayout.map((item) => item.id)));

      const response = await fetch(`/api/influencers/${codigo}/commissions/payouts`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao solicitar payout.");
      }

      toast.success("Pedido de payout enviado para validação da KLASSE.");
      setPayoutReceiptFile(null);
      await loadCommissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao solicitar payout.");
    } finally {
      setRequestingPayout(false);
    }
  };

  const loadPartnerMembers = async () => {
    try {
      const response = await fetch(`/api/influencers/${codigo}/members`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        members?: PartnerLoginMember[];
      } | null;

      if (response.ok && payload?.ok) {
        setPartnerMembers(Array.isArray(payload.members) ? payload.members : []);
      }
    } catch (err) {
      console.error("Failed to load partner members:", err);
    }
  };

  const loadTeamMembers = async (showLoading = false) => {
    if (showLoading) setLoadingTeam(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/team`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        members?: PartnerTeamMember[];
        error?: string;
      } | null;

      if (response.ok && payload?.ok) {
        setTeamMembers(Array.isArray(payload.members) ? payload.members : []);
        return;
      }

      if (response.status !== 403) {
        toast.error(payload?.error || "Falha ao carregar a equipe.");
      }
    } catch (err) {
      console.error("Failed to load partner team:", err);
      toast.error("Falha ao carregar a equipe.");
    } finally {
      if (showLoading) setLoadingTeam(false);
    }
  };

  const loadSupportTickets = async (showLoading = false) => {
    if (showLoading) setLoadingSupport(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/support/tickets`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        tickets?: PartnerSupportTicket[];
        summary?: PartnerSupportSummary;
        error?: string;
      } | null;

      if (response.ok && payload?.ok) {
        setSupportTickets(Array.isArray(payload.tickets) ? payload.tickets : []);
        setSupportSummary(payload.summary ?? null);
        return;
      }

      toast.error(payload?.error || "Falha ao carregar tickets de suporte.");
    } catch (err) {
      console.error("Failed to load support tickets:", err);
      toast.error("Falha ao carregar tickets de suporte.");
    } finally {
      if (showLoading) setLoadingSupport(false);
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
    const trialDays = Number(lead.trial_days);
    const taxaAtivacao = Number(lead.taxa_ativacao);
    setSelectedCrmLead(lead);
    setNextLeadAction(lead.proxima_acao || "");
    setNextLeadActionDate(lead.proxima_acao_data ? new Date(lead.proxima_acao_data).toISOString().split('T')[0] : "");
    setSelectedLeadResponsavelId(lead.responsavel_membro_id || lead.membro_id || memberId || "");
    setCommercialPlan(CRM_PLAN_OPTIONS.some((plan) => plan.value === lead.plano_estimado) ? lead.plano_estimado : "essencial");
    setCommercialAlunos(Number(lead.alunos_estimados) || 0);
    setCommercialTrialDays(Number.isFinite(trialDays) ? trialDays : 15);
    setCommercialTaxaAtivacao(Number.isFinite(taxaAtivacao) ? taxaAtivacao : 50000);
    setCommercialMensalidade(Number(lead.mensalidade_kz) || 0);
    setCommercialPreset(lead.curriculum_preset || "");
    setCommercialNiveisEnsino(Array.isArray(lead.niveis_ensino) ? lead.niveis_ensino : []);
    setCommercialSecretaria(lead.contacto_secretaria || {});
    setCommercialFinanceiro(lead.contacto_financeiro || {});
    setCommercialPedagogico(lead.contacto_pedagogico || {});
    setCommercialStatus(COMMERCIAL_STATUS_OPTIONS.some((item) => item.value === lead.commercial_status)
      ? lead.commercial_status
      : "rascunho");
    setProposalDocumentFile(null);
    setLeadActionNotes("");
    setSelectedStageToChange(lead.etapa);
    setLossReasonText(lead.motivo_perda || "");
    setCrmLeadDrawerOpen(true);
    await loadLeadHistory(lead.id);
  };

  const handleOpenSchool360Details = (school: OnboardingEscola) => {
    setSelectedSchoolForDetails(school);
    setDetailsDrawerOpen(true);
  };

  const handleRegisterSchool360Call = (school: OnboardingEscola) => {
    const nextPending = school.steps?.find((step) => step.status !== "concluido");
    setSelectedSchoolForCall(school);
    setSelectedStepCodeForCall(nextPending?.code || "");
    setCallModalOpen(true);
  };

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/portal`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        portal?: AfiliadoPortalResponse;
        assets?: MarketingAssetRow[];
        member?: { id?: string; name?: string; role?: string };
      } | null;

      if (!response.ok || !payload?.ok || !payload.portal || !isAfiliadoPortalResponse(payload.portal)) {
        setAuthError(true);
        return;
      }

      setAuthError(false);
      setStats(payload.portal.stats);
      setMemberId(typeof payload.member?.id === "string" ? payload.member.id : "");
      setMemberName(typeof payload.member?.name === "string" ? payload.member.name : "");
      const normalizedRole = PARTNER_MEMBER_ROLES.includes(payload.member?.role as PartnerMemberRole)
        ? payload.member?.role as PartnerMemberRole
        : "operator";
      setMemberRole(normalizedRole);
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
      await loadCommissions();
      await loadMarketingLeads();
      await loadPartnerMembers();
      await loadSupportTickets(false);
      if (normalizedRole === "owner" || normalizedRole === "admin") {
        await loadTeamMembers(false);
      }
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
          responsavel_membro_id: newLeadResponsavelId || memberId || null,
          trial_days: newLeadTrialDays,
          taxa_ativacao: newLeadTaxaAtivacao,
          marketing_lead_id: selectedMarketingLeadId || null,
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
      setNewLeadTrialDays(15);
      setNewLeadTaxaAtivacao(50000);
      setNewLeadAction("");
      setNewLeadActionDate("");
      setNewLeadResponsavelId("");
      setSelectedMarketingLeadId("");
      
      await loadCrmLeads(false);
      await loadMarketingLeads();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao cadastrar o lead.");
    } finally {
      setSavingLead(false);
    }
  };

  const handleSelectMarketingLead = (marketingLeadId: string) => {
    setSelectedMarketingLeadId(marketingLeadId);
    const marketingLead = marketingLeads.find((lead) => lead.id === marketingLeadId);
    if (!marketingLead) {
      return;
    }

    setNewLeadSchoolName(marketingLead.escola || "");
    setNewLeadContactName(marketingLead.nome || "");
    setNewLeadPhone(marketingLead.whatsapp || "");
    setNewLeadEmail(marketingLead.email || "");
  };

  const handleCrmModalOpenChange = (open: boolean) => {
    setCrmModalOpen(open);
    if (!open) {
      setSelectedMarketingLeadId("");
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
          responsavel_membro_id: selectedLeadResponsavelId || null,
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

  const handleConvertLeadToOnboarding = async () => {
    if (!selectedCrmLead) return;
    setConvertingLead(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads/${selectedCrmLead.id}/convert`, {
        method: "POST",
      });
      const res = await response.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        onboarding_request_id?: string;
        tracking_token?: string;
        already_converted?: boolean;
      } | null;

      if (!response.ok || !res?.ok) {
        toast.error(res?.error || "Erro ao iniciar ativação.");
        return;
      }

      toast.success(res.already_converted ? "Lead já tinha onboarding vinculado." : "Pedido de onboarding criado a partir do lead.");
      await loadCrmLeads(false);
      await loadLeadHistory(selectedCrmLead.id);
      setSelectedCrmLead((current: any) => current ? {
        ...current,
        etapa: "ganho",
        onboarding_request_id: res.onboarding_request_id,
        tracking_token: res.tracking_token,
      } : current);
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar ativação.");
    } finally {
      setConvertingLead(false);
    }
  };

  const handleSaveCommercialTerms = async () => {
    if (!selectedCrmLead) return;
    setSavingCommercialTerms(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads/${selectedCrmLead.id}/commercial`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          plano_estimado: commercialPlan,
          alunos_estimados: commercialAlunos,
          trial_days: commercialTrialDays,
          taxa_ativacao: commercialTaxaAtivacao,
          mensalidade_kz: commercialMensalidade,
          commercial_status: commercialStatus,
          curriculum_preset: commercialPreset,
          niveis_ensino: commercialNiveisEnsino,
          contacto_secretaria: commercialSecretaria,
          contacto_financeiro: commercialFinanceiro,
          contacto_pedagogico: commercialPedagogico,
        }),
      });
      const res = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !res?.ok) {
        toast.error(res?.error || "Erro ao salvar termos comerciais.");
        return;
      }

      toast.success("Termos comerciais atualizados.");
      setSelectedCrmLead((current: any) => current ? {
        ...current,
        plano_estimado: commercialPlan,
        alunos_estimados: commercialAlunos,
        trial_days: commercialTrialDays,
        taxa_ativacao: commercialTaxaAtivacao,
        mensalidade_kz: commercialMensalidade,
        commercial_status: commercialStatus,
        curriculum_preset: commercialPreset,
        niveis_ensino: commercialNiveisEnsino,
        contacto_secretaria: commercialSecretaria,
        contacto_financeiro: commercialFinanceiro,
        contacto_pedagogico: commercialPedagogico,
      } : current);
      await loadCrmLeads(false);
      await loadLeadHistory(selectedCrmLead.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar termos comerciais.");
    } finally {
      setSavingCommercialTerms(false);
    }
  };

  const handleUploadCommercialProposal = async () => {
    if (!selectedCrmLead || !proposalDocumentFile) return;
    setUploadingProposalFile(true);
    try {
      const formData = new FormData();
      formData.append("file", proposalDocumentFile);

      const response = await fetch(`/api/influencers/${codigo}/crm/leads/${selectedCrmLead.id}/proposal`, {
        method: "POST",
        body: formData,
      });
      const res = await response.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        fileName?: string;
        commercial_status?: string;
      } | null;

      if (!response.ok || !res?.ok) {
        toast.error(res?.error || "Erro ao anexar proposta.");
        return;
      }

      toast.success("Documento comercial anexado.");
      setProposalDocumentFile(null);
      setCommercialStatus(
        COMMERCIAL_STATUS_OPTIONS.some((item) => item.value === res.commercial_status)
          ? (res.commercial_status as (typeof COMMERCIAL_STATUS_OPTIONS)[number]["value"])
          : commercialStatus
      );
      setSelectedCrmLead((current: any) => current ? {
        ...current,
        proposal_file_name: res.fileName || proposalDocumentFile.name,
        commercial_status: res.commercial_status || current.commercial_status,
      } : current);
      await loadCrmLeads(false);
      await loadLeadHistory(selectedCrmLead.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao anexar proposta.");
    } finally {
      setUploadingProposalFile(false);
    }
  };

  const handleOpenCommercialProposal = async () => {
    if (!selectedCrmLead?.proposal_file_name) return;
    setOpeningProposalFile(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/crm/leads/${selectedCrmLead.id}/proposal`, {
        cache: "no-store",
      });
      const res = await response.json().catch(() => null) as { ok?: boolean; error?: string; signedUrl?: string } | null;
      if (!response.ok || !res?.ok || !res.signedUrl) {
        toast.error(res?.error || "Não foi possível abrir o documento.");
        return;
      }

      window.open(res.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível abrir o documento.");
    } finally {
      setOpeningProposalFile(false);
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

  const handleCreateTeamMember = async () => {
    if (!newMemberName.trim() || !newMemberPin.trim()) {
      toast.error("Informe o nome e o PIN do membro.");
      return;
    }

    setSavingTeamMember(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/team`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: newMemberName.trim(),
          pin: newMemberPin.trim(),
          role: newMemberRole,
          ativo: true,
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error || "Falha ao criar membro.");
        return;
      }

      toast.success("Membro criado com sucesso.");
      setNewMemberName("");
      setNewMemberPin("");
      setNewMemberRole("vendas");
      await loadTeamMembers(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao criar membro.");
    } finally {
      setSavingTeamMember(false);
    }
  };

  const handleUpdateTeamMember = async (
    memberId: string,
    changes: Partial<Pick<PartnerTeamMember, "nome" | "role" | "ativo">> & { pin?: string }
  ) => {
    setSavingTeamMember(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/team`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, ...changes }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error || "Falha ao atualizar membro.");
        return;
      }

      toast.success("Membro atualizado.");
      setResetPins((current) => ({ ...current, [memberId]: "" }));
      await loadTeamMembers(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao atualizar membro.");
    } finally {
      setSavingTeamMember(false);
    }
  };

  const handleDeleteTeamMember = async (memberId: string) => {
    setSavingTeamMember(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/team?memberId=${memberId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error || "Falha ao remover membro.");
        return;
      }

      toast.success("Membro removido com sucesso.");
      await loadTeamMembers(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao remover membro.");
    } finally {
      setSavingTeamMember(false);
    }
  };

  const handleCreateSupportTicket = async () => {
    if (!newSupportTitle.trim()) {
      toast.error("Informe o título do ticket.");
      return;
    }

    if (!newSupportSchoolToken && !newSupportSchoolName.trim()) {
      toast.error("Selecione uma ativação ou informe o nome da escola.");
      return;
    }

    setSavingSupportTicket(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/support/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          onboarding_token: newSupportSchoolToken || null,
          escola_nome: newSupportSchoolName.trim() || null,
          canal: newSupportCanal,
          categoria: newSupportCategoria,
          gravidade: newSupportGravidade,
          titulo: newSupportTitle.trim(),
          descricao: newSupportDescription.trim() || null,
          responsavel_membro_id: newSupportResponsavelId || null,
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error || "Falha ao abrir ticket.");
        return;
      }

      toast.success("Ticket de suporte aberto.");
      setNewSupportSchoolToken("");
      setNewSupportSchoolName("");
      setNewSupportTitle("");
      setNewSupportDescription("");
      setNewSupportCanal("whatsapp");
      setNewSupportCategoria("operacional");
      setNewSupportGravidade("media");
      setNewSupportResponsavelId("");
      await loadSupportTickets(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao abrir ticket.");
    } finally {
      setSavingSupportTicket(false);
    }
  };

  const handleUpdateSupportTicket = async (
    ticketId: string,
    status: PartnerSupportStatus,
    escalationReason?: string
  ) => {
    if (status === "escalado_klasse" && !String(escalationReason || "").trim()) {
      toast.error("Informe o motivo da escalação para KLASSE.");
      return;
    }

    setSavingSupportTicket(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/support/tickets`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          status,
          note: supportUpdateNote.trim() || null,
          escalation_reason: status === "escalado_klasse" ? String(escalationReason || "").trim() : null,
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error || "Falha ao atualizar ticket.");
        return;
      }

      toast.success("Ticket atualizado.");
      setSupportUpdateNote("");
      if (status === "escalado_klasse") {
        setSupportEscalationReason("");
      }
      await loadSupportTickets(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao atualizar ticket.");
    } finally {
      setSavingSupportTicket(false);
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

  const estimatedComissao = onboardingStats?.escolas?.reduce((acc, esc) => {
    if (esc.status === 'activo') {
      return acc + calcComissaoEscola(esc.plano, esc.total_alunos);
    }
    return acc;
  }, 0) || 0;
  const totalComissaoReal =
    Number(commissionSummary?.pending_kz ?? 0) +
    Number(commissionSummary?.approved_kz ?? 0) +
    Number(commissionSummary?.paid_kz ?? 0);
  const totalComissao = totalComissaoReal > 0 ? totalComissaoReal : estimatedComissao;

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
  const openCrmTasks = crmLeads
    .filter((lead) => lead.etapa !== "ganho" && lead.etapa !== "perdido" && lead.proxima_acao)
    .sort((a, b) => {
      const left = a.proxima_acao_data ? new Date(a.proxima_acao_data).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.proxima_acao_data ? new Date(b.proxima_acao_data).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    });
  const overdueCrmTasks = openCrmTasks.filter(
    (lead) => lead.proxima_acao_data && new Date(lead.proxima_acao_data).getTime() < Date.now()
  );
  const nextCrmTasks = openCrmTasks.filter(
    (lead) => !lead.proxima_acao_data || new Date(lead.proxima_acao_data).getTime() >= Date.now()
  );
  const visibleCrmTasks = [...overdueCrmTasks, ...nextCrmTasks].slice(0, 6);

  const totalCrmPipelineValue = activeCrmLeads.reduce((acc, lead) => {
    return acc + getCommissionForPlan(lead.plano_estimado);
  }, 0);
  const operatorProductivity: PartnerOperatorProductivity[] = partnerMembers
    .map((member) => {
      const memberLeads = crmLeads.filter((lead) =>
        (lead.responsavel_membro_id || lead.membro_id) === member.membro_id
      );
      const memberActiveLeads = memberLeads.filter((lead) => lead.etapa !== "perdido" && lead.etapa !== "ganho");
      return {
        membro_id: member.membro_id,
        membro_nome: member.membro_nome,
        total_leads: memberLeads.length,
        active_leads: memberActiveLeads.length,
        overdue_tasks: memberLeads.filter(
          (lead) =>
            lead.etapa !== "ganho" &&
            lead.etapa !== "perdido" &&
            lead.proxima_acao_data &&
            new Date(lead.proxima_acao_data).getTime() < Date.now()
        ).length,
        missing_next_action: memberLeads.filter(
          (lead) => lead.etapa !== "ganho" && lead.etapa !== "perdido" && !lead.proxima_acao
        ).length,
        won_leads: memberLeads.filter((lead) => lead.etapa === "ganho").length,
        lost_leads: memberLeads.filter((lead) => lead.etapa === "perdido").length,
        pipeline_value_kz: memberActiveLeads.reduce(
          (acc, lead) => acc + getCommissionForPlan(lead.plano_estimado),
          0
        ),
      };
    })
    .sort((a, b) => b.overdue_tasks - a.overdue_tasks || b.active_leads - a.active_leads || a.membro_nome.localeCompare(b.membro_nome));
  const selectedCommercialStatusMeta = COMMERCIAL_STATUS_OPTIONS.find((item) => item.value === commercialStatus) || COMMERCIAL_STATUS_OPTIONS[0];
  const selectedLeadDraft = selectedCrmLead ? {
    ...selectedCrmLead,
    plano_estimado: commercialPlan,
    alunos_estimados: commercialAlunos,
    trial_days: commercialTrialDays,
    taxa_ativacao: commercialTaxaAtivacao,
    mensalidade_kz: commercialMensalidade,
    commercial_status: commercialStatus,
  } : null;
  const selectedLeadConversionBlockers = selectedLeadDraft ? getLeadConversionBlockers(selectedLeadDraft) : [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  useEffect(() => {
    loadData(true);
  }, [codigo]);

  useEffect(() => {
    setImplantationChecklistDraft(normalizeImplantationChecklist(selectedSchoolForDetails?.implantation_checklist));
  }, [selectedSchoolForDetails]);

  const handleToggleImplantationItem = (code: string) => {
    setImplantationChecklistDraft((current) =>
      current.map((item) => {
        if (item.code !== code) return item;
        const nextCompleted = !item.completed;
        return {
          ...item,
          completed: nextCompleted,
          completed_at: nextCompleted ? item.completed_at ?? new Date().toISOString() : null,
        };
      })
    );
  };

  const handleChangeImplantationNote = (code: string, note: string) => {
    setImplantationChecklistDraft((current) =>
      current.map((item) => (
        item.code === code
          ? { ...item, note }
          : item
      ))
    );
  };

  const handleSaveImplantationChecklist = async () => {
    if (!selectedSchoolForDetails?.token) return;
    setSavingImplantationChecklist(true);
    try {
      const response = await fetch(`/api/influencers/${codigo}/onboarding/${selectedSchoolForDetails.token}/checklist`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          items: implantationChecklistDraft.map((item) => ({
            code: item.code,
            label: item.label,
            completed: item.completed,
            note: item.note ?? null,
            completed_at: item.completed ? item.completed_at ?? new Date().toISOString() : null,
          })),
        }),
      });
      const res = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !res?.ok) {
        if (response.status === 401) {
          setAuthError(true);
        }
        toast.error(res?.error || "Erro ao salvar checklist de implantação.");
        return;
      }

      toast.success("Checklist de implantação atualizado.");
      await loadData(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar checklist de implantação.");
    } finally {
      setSavingImplantationChecklist(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/influencers/session", { method: "DELETE" }).catch(() => null);
    router.push("/parceiros");
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full p-8 rounded-[32px] space-y-6 shadow-xl">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
            <p className="text-slate-500">A sua sessão expirou ou o acesso é inválido. Por favor, valide o seu código e PIN novamente.</p>
          </div>
          <Button onClick={() => router.push('/parceiros')} className="w-full bg-slate-900 py-6 rounded-2xl font-bold">
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
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">A carregar o painel da parceria...</p>
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
  const countPendenteSupport = supportTickets.filter(
    (ticket) =>
      ticket.status !== "resolvido" &&
      (
        (!ticket.first_responded_at && new Date(ticket.first_response_due_at).getTime() < Date.now()) ||
        new Date(ticket.resolution_due_at).getTime() < Date.now()
      )
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
      countPendenteSupport={countPendenteSupport}
      onLogout={handleLogout}
    >
      <Tabs defaultValue="crm" value={activeTab} onValueChange={setActiveTab as any} className="w-full">
          <TabsContent value="campanha" className="m-0 space-y-8">
            <CampanhaTabContent
              codigo={codigo}
              campaignUrl={campaignUrl}
              onboardingUrl={onboardingUrl}
              copyToClipboard={copyToClipboard}
              memberRole={memberRole}
            />
          </TabsContent>

          <TabsContent value="crm" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Leads header with Button */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">CRM Pré-Vendas</p>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leads Comerciais</h2>
              </div>
              <Button
                onClick={() => setCrmModalOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs uppercase tracking-wider px-5 py-2.5 h-auto rounded-xl border-none shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Plus size={16} />
                Novo Lead
              </Button>
            </div>

            {/* Leads metrics grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)] overflow-hidden">
                  <CardContent className="p-5 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                      <Target size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Leads Ativos</p>
                      <p className="text-2xl font-bold text-zinc-900 font-mono mt-0.5">{totalCrmLeadsCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)] overflow-hidden">
                  <CardContent className="p-5 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Em Prospecção</p>
                      <p className="text-2xl font-bold text-blue-600 font-mono mt-0.5">{newCrmLeadsCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)] overflow-hidden">
                  <CardContent className="p-5 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                      <School size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Contacto & Demo</p>
                      <p className="text-2xl font-bold text-purple-600 font-mono mt-0.5">{inContactCrmCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)] overflow-hidden">
                  <CardContent className="p-5 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Em Negociação</p>
                      <p className="text-2xl font-bold text-amber-600 font-mono mt-0.5">{negotiatingCrmCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

            <Card className="rounded-2xl border-zinc-200/50 bg-white shadow-sm">
              <CardHeader className="p-6 pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Mesa do operador</p>
                    <CardTitle className="text-lg font-bold text-zinc-900 tracking-tight">Próximas ações comerciais</CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Lista curta para o operador fechar o dia sem perder follow-up de escolas em prospecção.
                    </CardDescription>
                  </div>
                  <Badge className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 border border-rose-100 shadow-none">
                    {overdueCrmTasks.length} atrasadas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {visibleCrmTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                    <p className="text-sm font-bold text-zinc-700">Nenhuma próxima ação pendente.</p>
                    <p className="mt-1 text-xs text-zinc-500">Cadastre follow-ups nos leads para manter o funil ativo.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleCrmTasks.map((lead) => {
                      const isOverdue = lead.proxima_acao_data && new Date(lead.proxima_acao_data).getTime() < Date.now();
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => handleOpenLeadDrawer(lead)}
                          className={`rounded-xl border p-4 text-left transition hover:shadow-sm ${
                            isOverdue
                              ? "border-rose-200 bg-rose-50/50"
                              : "border-zinc-200 bg-zinc-50/60 hover:bg-white"
                          }`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-zinc-900">{lead.nome_escola}</p>
                              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                {CRM_STAGES[lead.etapa]?.label ?? lead.etapa}
                              </p>
                              <p className="mt-1 truncate text-[10px] font-bold text-zinc-500">
                                Responsável: {lead.responsavel_membro_nome || lead.membro_nome || "Sem responsável"}
                              </p>
                            </div>
                            <ArrowRight size={14} className="shrink-0 text-zinc-400" />
                          </div>
                          <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-zinc-700">{lead.proxima_acao}</p>
                          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                            <Clock size={12} />
                            {lead.proxima_acao_data
                              ? format(new Date(lead.proxima_acao_data), "dd/MM/yyyy")
                              : "Sem data definida"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Funil de Vendas (CRM Leads) rendering */}
            {pipelineMode === 'leads' && (
              <Card className="rounded-2xl border-zinc-200/50 bg-white shadow-sm">
                <CardHeader className="p-6 pb-0">
                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">CRM Pré-Vendas</p>
                  <CardTitle className="text-lg font-bold text-zinc-900 tracking-tight">Negociações Comerciais Ativas</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Cadastre e faça a prospecção ativa de escolas antes do onboarding técnico. Arraste e clique para gerenciar ações de follow-up.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {/* Pipeline Value summary */}
                  {activeCrmLeads.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {memberRole === 'owner' ? (
                        <>
                          <div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Potencial de Receita Comercial</p>
                            <p className="text-xl font-bold text-klasse-gold">
                              Kz {totalCrmPipelineValue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="text-xs text-slate-400 max-w-md font-medium">
                            Faturamento potencial estimado com base nos leads ativos.
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Negociações em Curso</p>
                            <p className="text-xl font-bold text-[#10b981]">
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
                          <div key={stageCode} className="w-72 shrink-0 flex flex-col gap-2">
                            <div className="flex items-center justify-between px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{stageMeta.label}</span>
                                <span className="bg-zinc-100 text-zinc-500 font-semibold text-[9px] px-1.5 py-0.5 rounded-md border border-zinc-200/50">
                                  {leadsInStage.length}
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-2.5 p-2 rounded-xl bg-zinc-50/50 border border-zinc-200/40 min-h-[450px]">
                              {leadsInStage.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-6 text-center text-zinc-300">
                                  <p className="text-[9px] font-semibold uppercase tracking-wider">Sem Leads</p>
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
                                      className={`group relative rounded-xl border p-4 shadow-sm bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all flex flex-col gap-2.5 cursor-pointer ${
                                        isLeadOverdue ? 'border-rose-200 bg-rose-50/10 ring-1 ring-rose-100/30' : 'border-zinc-200/60 hover:border-zinc-300'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="font-semibold text-zinc-950 text-xs truncate" title={lead.nome_escola}>
                                            {lead.nome_escola}
                                          </p>
                                          {isLeadOverdue && (
                                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase bg-rose-50 text-rose-600 border border-rose-200/40">
                                              {delayDays === 1 ? '1d atrasado' : `${delayDays}d atrasado`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] font-medium text-zinc-400">
                                          <span className="truncate max-w-[120px]">Contato: {lead.nome_contacto || "Não informado"}</span>
                                          {lead.alunos_estimados > 0 && <span className="font-mono">{lead.alunos_estimados} al.</span>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-[9px] font-semibold text-zinc-500">
                                            Resp.: {lead.responsavel_membro_nome || lead.membro_nome || "Sem dono"}
                                          </p>
                                          {lead.marketing_lead_id ? (
                                            <Badge className="border border-amber-200 bg-amber-50 px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider text-amber-700 shadow-none">
                                              Marketing
                                            </Badge>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-2 text-[9px] font-medium text-zinc-500">
                                        <div className="flex justify-between items-center">
                                          <span>Plano: {lead.plano_estimado}</span>
                                          {memberRole === 'owner' && (
                                            <span className="font-semibold text-emerald-600 font-mono">
                                              Kz {getCommissionForPlan(lead.plano_estimado).toLocaleString('pt-PT')}
                                            </span>
                                          )}
                                        </div>

                                        {lead.proxima_acao ? (
                                          <div className={`mt-1 flex items-start gap-1.5 p-1.5 rounded-lg border ${
                                            isLeadOverdue ? 'bg-rose-50/40 border-rose-100/50 text-rose-600' : 'bg-zinc-50 border-zinc-100/50 text-zinc-600'
                                          }`}>
                                            <Clock size={10} className="mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                              <p className="font-semibold truncate text-[8px] uppercase tracking-wider">Ação: {lead.proxima_acao}</p>
                                              {lead.proxima_acao_data && (
                                                <p className="text-[8px] mt-0.5 font-mono">Prazo: {format(new Date(lead.proxima_acao_data), "dd/MM/yyyy")}</p>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="mt-1 flex items-center gap-1.5 p-1.5 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/30 text-zinc-400">
                                            <FileQuestion size={10} />
                                            <span className="text-[8px] font-semibold uppercase tracking-wider">Sem próxima ação definida</span>
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
                    <div className="space-y-2.5">
                      {crmLeads.map((lead) => {
                        const isLeadOverdue = lead.proxima_acao_data && new Date(lead.proxima_acao_data).getTime() < Date.now();
                        const stageMeta = CRM_STAGES[lead.etapa as keyof typeof CRM_STAGES] || CRM_STAGES.prospeccao;
                        return (
                          <div
                            key={lead.id}
                            onClick={() => handleOpenLeadDrawer(lead)}
                            className="flex flex-col gap-3 rounded-xl border border-zinc-200/50 bg-white p-4 shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all cursor-pointer"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate font-bold text-zinc-900">{lead.nome_escola}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-medium text-zinc-400">
                                  <span className="font-mono">Cadastrado em: {format(new Date(lead.created_at), "dd MMM, HH:mm", { locale: pt })}</span>
                                  <span>Responsável: {lead.responsavel_membro_nome || lead.membro_nome || "Sem responsável"}</span>
                                  {lead.alunos_estimados > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono">{lead.alunos_estimados} alunos</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isLeadOverdue && (
                                  <Badge className="bg-rose-50 text-rose-600 border border-rose-200/40 font-semibold uppercase text-[8px] px-2 py-0.5 rounded-md shadow-none">
                                    Ação Atrasada
                                  </Badge>
                                )}
                                <Badge className="border border-zinc-200 bg-zinc-50 text-[8px] font-semibold uppercase tracking-wider text-zinc-600 px-2 py-0.5 rounded-md shadow-none">
                                  Plano: {lead.plano_estimado}
                                </Badge>
                                {lead.commercial_status && (
                                  <Badge className={`${COMMERCIAL_STATUS_OPTIONS.find((item) => item.value === lead.commercial_status)?.color || "bg-zinc-100 text-zinc-700"} border border-zinc-200/20 text-[8px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-none`}>
                                    {COMMERCIAL_STATUS_OPTIONS.find((item) => item.value === lead.commercial_status)?.label || lead.commercial_status}
                                  </Badge>
                                )}
                                {lead.marketing_lead_id ? (
                                  <Badge className="border border-amber-200 bg-amber-50 text-[8px] font-semibold uppercase tracking-wider text-amber-700 px-2 py-0.5 rounded-md shadow-none">
                                    Origem marketing
                                  </Badge>
                                ) : null}
                                <Badge className={`${stageMeta.color} border border-zinc-200/10 font-semibold uppercase text-[8px] px-2 py-0.5 rounded-md shadow-none`}>
                                  <span className={`w-1 h-1 rounded-full ${stageMeta.dot} mr-1.5`} />
                                  {stageMeta.label}
                                </Badge>
                              </div>
                            </div>

                            {lead.proxima_acao && (
                              <div className="mt-1 pt-2 border-t border-zinc-100 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                                <p className="truncate">
                                  Próximo Passo: <span className="font-semibold text-zinc-800">{lead.proxima_acao}</span>
                                  {lead.proxima_acao_data && (
                                    <span className="text-zinc-400 font-medium font-mono"> (até {format(new Date(lead.proxima_acao_data), "dd/MM/yyyy")})</span>
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Processo de Onboarding</p>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Onboarding e Provisionamento</h2>
              </div>
            </div>

            {/* Onboarding metrics grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-xl border-zinc-200/50 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                    <BarChart3 size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Pedidos criados</p>
                    <p className="text-2xl font-bold text-zinc-900 font-mono mt-0.5">{onboardingStats?.total ?? stats?.total_diagnosticos}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-zinc-200/50 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Clock size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Pedidos pendentes</p>
                    <p className="text-2xl font-bold text-blue-600 font-mono mt-0.5">{onboardingStats?.pendentes ?? stats?.novos}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-zinc-200/50 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Onboarding em curso</p>
                    <p className="text-2xl font-bold text-amber-600 font-mono mt-0.5">{onboardingStats?.em_configuracao ?? stats?.em_contacto}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm overflow-hidden">
                <CardContent className="p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-white">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wider">Escolas provisionadas</p>
                    <p className="text-2xl font-bold text-emerald-600 font-mono mt-0.5">{onboardingStats?.fechadas ?? stats?.convertidos}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Funil de Ativação (Onboarding) rendering */}
            {onboardingStats && (
              <Card className="rounded-2xl border-zinc-200/50 bg-white shadow-sm">
                <CardHeader className="p-6 pb-0">
                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Pedido de escolas</p>
                  <CardTitle className="text-lg font-bold text-zinc-900 tracking-tight">Escolas que usaram o seu código</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Depois da conversão do lead, aqui você acompanha onboarding operacional, provisionamento e aceite de implantação. O setup académico final acontece no portal da escola.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {/* Responsabilidade de Etapas Pendentes */}
                  {schoolsList.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200/50 text-center">
                        <div>
                          <p className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Ações com Escola</p>
                          <p className="text-lg font-bold text-zinc-900 font-mono">{pendingStepsStats['Escola'] || 0}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Ações com Parceiro</p>
                          <p className="text-lg font-bold text-zinc-900 font-mono">{pendingStepsStats['Parceiro'] || 0}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Ações com KLASSE</p>
                          <p className="text-lg font-bold text-zinc-900 font-mono">{pendingStepsStats['KLASSE'] || 0}</p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-zinc-50/20 border border-zinc-200 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <p className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Pendências por etapa</p>
                          <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">{Object.keys(pendingStepCodeStats).length} etapa(s)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(pendingStepCodeStats)
                            .sort((a, b) => b[1] - a[1])
                            .map(([code, total]) => (
                              <Badge key={code} className="bg-zinc-100 text-zinc-600 border border-zinc-200 font-semibold text-[9px] px-2 py-0.5 rounded-md shadow-none">
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
                      <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100/60 p-1 rounded-lg border border-zinc-200/50">
                        <button
                          onClick={() => setOnboardingFilter('todos')}
                          className={`px-3 py-1.5 rounded-md font-semibold text-[11px] uppercase tracking-wider transition-all ${
                            onboardingFilter === 'todos'
                              ? 'bg-zinc-950 text-white shadow-sm'
                              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/40'
                          }`}
                        >
                          Todos ({countTodos})
                        </button>
                        <button
                          onClick={() => setOnboardingFilter('pendente')}
                          className={`px-3 py-1.5 rounded-md font-semibold text-[11px] uppercase tracking-wider transition-all ${
                            onboardingFilter === 'pendente'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/40'
                          }`}
                        >
                          Pendentes ({countPendente})
                        </button>
                        <button
                          onClick={() => setOnboardingFilter('atrasado')}
                          className={`px-3 py-1.5 rounded-md font-semibold text-[11px] uppercase tracking-wider transition-all ${
                            onboardingFilter === 'atrasado'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/40'
                          }`}
                        >
                          Atrasados ({countAtrasado})
                        </button>
                        <button
                          onClick={() => setOnboardingFilter('concluido')}
                          className={`px-3 py-1.5 rounded-md font-semibold text-[11px] uppercase tracking-wider transition-all ${
                            onboardingFilter === 'concluido'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/40'
                          }`}
                        >
                          Provisionadas ({countConcluido})
                        </button>
                      </div>

                      {/* Alternador de Visualização (Lista vs Kanban) */}
                      <div className="flex items-center gap-1.5 bg-zinc-100/60 p-1 rounded-lg border border-zinc-200/50">
                        <button
                          type="button"
                          onClick={() => setViewMode('lista')}
                          className={`px-2.5 py-1.5 rounded-md font-semibold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                            viewMode === 'lista'
                              ? 'bg-zinc-950 text-white shadow-sm'
                              : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                        >
                          <List size={12} className="shrink-0" />
                          Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('kanban')}
                          className={`px-2.5 py-1.5 rounded-md font-semibold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                            viewMode === 'kanban'
                              ? 'bg-zinc-950 text-white shadow-sm'
                              : 'text-zinc-50 hover:text-zinc-950'
                          }`}
                        >
                          <LayoutGrid size={12} className="shrink-0" />
                          CRM / Kanban
                        </button>
                      </div>
                    </div>
                  )}

                  {filteredSchools.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center">
                      <School className="mx-auto mb-4 h-10 w-10 text-zinc-300 animate-pulse" />
                      <p className="text-xs font-semibold text-zinc-400">Nenhum pedido de escola nesta categoria.</p>
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
                                <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">{meta.short}</span>
                                <span className="bg-slate-100 text-slate-600 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200/50">
                                  {schoolsInStep.length}
                                </span>
                              </div>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{meta.ownerLabel}</span>
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
                                   const lastCall = getLatestOnboardingCall(escola);
                                   
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
                                           <p className="font-bold text-slate-900 text-xs truncate" title={escola.escola}>
                                             {escola.escola}
                                           </p>
                                           {isSchoolOverdue && (
                                             <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-rose-100 text-rose-700 animate-pulse">
                                               {delayDays === 1 ? '1d atraso' : `${delayDays}d atraso`}
                                             </span>
                                           )}
                                         </div>
                                         <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                           <span className="truncate max-w-[120px]">Plano: {escola.plano_label || escola.plano || "N/I"}</span>
                                           {escola.total_alunos && <span>{escola.total_alunos} al.</span>}
                                         </div>
                                         {lastCall && (
                                           <div className="rounded-lg bg-blue-50 border border-blue-100 px-2 py-1 text-[9px] font-bold text-blue-700">
                                             Última ligação: {lastCall.member_name} · {format(new Date(lastCall.realizado_em), "dd MMM, HH:mm", { locale: pt })}
                                           </div>
                                         )}
                                         <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                                           <span>
                                             Implantação: {getImplantationProgress(escola).completed}/{getImplantationProgress(escola).total}
                                           </span>
                                           <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${(
                                             IMPLANTATION_STATUS_CONFIG[
                                               (escola.implantation_status as keyof typeof IMPLANTATION_STATUS_CONFIG) || "implantacao_em_andamento"
                                             ] || IMPLANTATION_STATUS_CONFIG.implantacao_em_andamento
                                           ).color}`}>
                                             {(
                                               IMPLANTATION_STATUS_CONFIG[
                                                 (escola.implantation_status as keyof typeof IMPLANTATION_STATUS_CONFIG) || "implantacao_em_andamento"
                                               ] || IMPLANTATION_STATUS_CONFIG.implantacao_em_andamento
                                             ).label}
                                           </span>
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
                                                    `Olá! Acompanhe o processo de onboarding da sua escola (${escola.escola}) em tempo real no nosso Portal de Onboarding. Por lá, você poderá enviar documentos e planilhas pendentes, além de acompanhar o prazo de cada etapa.\n\nLink de acesso seguro: ${typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${escola.token}` : ''}`
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
                        const lifecycleMeta = getOnboardingLifecycleMeta(escola);
                        const nextPendingStep = escola.steps?.find(step => step.status !== 'concluido') ?? null;
                        const isSchoolOverdue = escola.steps?.some(st => st.status !== 'concluido' && st.deadline && new Date(st.deadline).getTime() < Date.now()) ?? false;
                        const lastCall = getLatestOnboardingCall(escola);
                        
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
                                <p className="truncate font-bold text-slate-900">{escola.escola}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                  <span>{format(new Date(escola.data), "dd MMM, HH:mm", { locale: pt })}</span>
                                  {escola.total_alunos && (
                                    <>
                                      <span>•</span>
                                      <span>{escola.total_alunos} alunos</span>
                                    </>
                                  )}
                                  {lastCall && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-600">
                                        Última ligação: {format(new Date(lastCall.realizado_em), "dd MMM, HH:mm", { locale: pt })}
                                      </span>
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
                                <Badge className="border border-klasse-gold-200 bg-klasse-gold-100 text-[9px] font-bold uppercase tracking-widest text-klasse-gold-700">
                                  Plano: {escola.plano_label || escola.plano || "Não informado"}
                                </Badge>
                                <Badge className="border border-slate-200 bg-slate-100 text-[9px] font-bold uppercase tracking-widest text-slate-700">
                                  Implantação: {getImplantationProgress(escola).completed}/{getImplantationProgress(escola).total}
                                </Badge>
                                <Badge className={`${status.color} border-none font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg`}>
                                  <span className={`w-1 h-1 rounded-full ${status.dot} mr-2`} />
                                  {status.label}
                                </Badge>
                                <Badge className={`${lifecycleMeta.color} font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg`}>
                                  {lifecycleMeta.shortLabel}
                                </Badge>
                                <Badge className={`${(
                                  IMPLANTATION_STATUS_CONFIG[
                                    (escola.implantation_status as keyof typeof IMPLANTATION_STATUS_CONFIG) || "implantacao_em_andamento"
                                  ] || IMPLANTATION_STATUS_CONFIG.implantacao_em_andamento
                                ).color} font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg`}>
                                  {(
                                    IMPLANTATION_STATUS_CONFIG[
                                      (escola.implantation_status as keyof typeof IMPLANTATION_STATUS_CONFIG) || "implantacao_em_andamento"
                                    ] || IMPLANTATION_STATUS_CONFIG.implantacao_em_andamento
                                  ).label}
                                </Badge>
                              </div>
                            </div>

                            {/* Detailed Onboarding Step checklist progress & link */}
                            {escola.steps && escola.steps.length > 0 && (
                              <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-col gap-2">
                                  <p className="text-[11px] font-semibold leading-relaxed text-slate-600">
                                    {lifecycleMeta.description}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 font-bold">Workflow 7 etapas:</span>
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
                                      Próxima fase: <span className="font-bold text-slate-900">{getStepMeta(nextPendingStep.code, nextPendingStep.owner).short}</span>
                                      {" · "}
                                      <span className="text-slate-500">Responsável: {getStepMeta(nextPendingStep.code, nextPendingStep.owner).ownerLabel}</span>
                                    </p>
                                  ) : (
                                    <p className="text-[11px] font-medium text-emerald-700">
                                      Workflow operacional concluído. Escola provisionada no backoffice.
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                                  {nextPendingStep ? (
                                    <Badge className="border border-slate-200 bg-slate-100 text-[9px] font-bold uppercase tracking-widest text-slate-700">
                                      Em curso: {getStepMeta(nextPendingStep.code, nextPendingStep.owner).short}
                                    </Badge>
                                  ) : (
                                    <Badge className="border border-emerald-200 bg-emerald-100 text-[9px] font-bold uppercase tracking-widest text-emerald-700">
                                      Provisionada
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
                                      className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
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
                                        className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
                                      >
                                        <Copy size={12} className="text-slate-400" />
                                        COPIAR LINK
                                      </Button>
                                      <a
                                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                          `Olá! Acompanhe o processo de onboarding da sua escola (${escola.escola}) em tempo real no nosso Portal de Onboarding. Por lá, você poderá enviar documentos e planilhas pendentes, além de acompanhar o prazo de cada etapa.\n\nLink de acesso seguro: ${typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${escola.token}` : ''}`
                                        )}${
                                          escola.director_tel || escola.escola_tel
                                            ? `&phone=${(escola.director_tel || escola.escola_tel || '').replace(/\D/g, '')}`
                                            : ''
                                        }`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 rounded-xl bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 px-3 text-[10px] font-bold text-white flex items-center justify-center gap-1.5 shadow-none no-underline"
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Tendência de Crescimento</p>
                  <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">Diagnósticos concluídos (últimos 7 dias)</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-klasse-gold animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Live Update</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-8 h-[240px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                        Resultado da Parceria
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Você recebe 100% da taxa de ativação (50k-100k Kz) + 25% de todas as mensalidades recorrentes como faturamento da parceria.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 space-y-5">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {totalComissaoReal > 0 ? "Total em Ledger" : "Total Estimado"}
                        </p>
                        <p className="text-2xl font-bold text-klasse-gold">
                          {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalComissao).replace('AOA', 'Kz')}
                        </p>
                        {commissionSummary && commissionSummary.count > 0 && (
                          <div className="grid grid-cols-3 gap-2 pt-3 text-[10px]">
                            <div className="rounded-xl bg-white/5 p-2">
                              <p className="font-bold uppercase tracking-wider text-slate-500">Pendente</p>
                              <p className="mt-1 font-bold text-white">
                                {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(commissionSummary.pending_kz).replace('AOA', 'Kz')}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-2">
                              <p className="font-bold uppercase tracking-wider text-slate-500">Aprovado</p>
                              <p className="mt-1 font-bold text-white">
                                {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(commissionSummary.approved_kz).replace('AOA', 'Kz')}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-2">
                              <p className="font-bold uppercase tracking-wider text-slate-500">Pago</p>
                              <p className="mt-1 font-bold text-white">
                                {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(commissionSummary.paid_kz).replace('AOA', 'Kz')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Payout disponível</p>
                            <p className="mt-1 text-xl font-bold text-white">
                              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(availablePayoutKz).replace('AOA', 'Kz')}
                            </p>
                             <p className="mt-1 text-[10px] font-semibold text-emerald-100/80">
                              {approvedCommissionsAvailableForPayout.length} faturamento(s) aprovado(s) sem pedido.
                            </p>
                          </div>
                          <Badge className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[9px] font-bold uppercase text-emerald-100 shadow-none">
                            Sprint 7
                          </Badge>
                        </div>

                        <label className="block">
                          <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-300">
                            Fatura/recibo obrigatório
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                            onChange={(event) => setPayoutReceiptFile(event.target.files?.[0] ?? null)}
                          className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:uppercase file:text-white hover:file:bg-zinc-700 transition-all cursor-pointer"
                          />
                        </label>

                        <Button
                          type="button"
                          onClick={handleRequestPayout}
                          disabled={availablePayoutKz <= 0 || !payoutReceiptFile || requestingPayout}
                          className="w-full rounded-xl bg-zinc-900 text-xs font-semibold uppercase tracking-wider text-white hover:bg-zinc-800 transition-all"
                        >
                          {requestingPayout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Solicitar Payout
                        </Button>
                      </div>

                      {commissionItems.length > 0 && (
                        <div className="space-y-2 border-t border-white/10 pt-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Últimos faturamentos</h4>
                          <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                            {commissionItems.slice(0, 5).map((item) => (
                              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-bold text-white">{item.escola_nome || "Escola"}</p>
                                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{item.status}</p>
                                    {item.payout_status ? (
                                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                                        Payout: {item.payout_status}
                                      </p>
                                    ) : null}
                                  </div>
                                  <p className="text-xs font-bold text-klasse-gold">
                                    {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(item.valor_kz).replace('AOA', 'Kz')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {commissionPayouts.length > 0 && (
                        <div className="space-y-2 border-t border-white/10 pt-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Pedidos de payout</h4>
                          <div className="space-y-2">
                            {commissionPayouts.slice(0, 3).map((payout) => (
                              <div key={payout.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white">
                                      {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(payout.total_kz).replace('AOA', 'Kz')}
                                    </p>
                                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                      {payout.status} · {payout.commission_count} faturamento(s)
                                    </p>
                                  </div>
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                    {format(new Date(payout.requested_at), "dd/MM/yyyy")}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                                className={`py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all
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
                            <span className="text-white font-bold">{calcAlunos}</span>
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

                        <div className="space-y-2 pt-2">
                          <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400">Ativação (100% único):</span>
                            <span className="font-bold text-klasse-gold">
                              {(() => {
                                let actFee = 50000;
                                if (calcPlan === 'profissional') actFee = 80000;
                                if (calcPlan === 'premium') actFee = 100000;
                                return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(actFee).replace('AOA', 'Kz');
                              })()}
                            </span>
                          </div>

                          <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400">Recorrência Mensal (25%):</span>
                            <span className="font-bold text-klasse-gold">
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
                      </div>

                      <p className="text-[10px] text-slate-500 italic">Os pagamentos são processados até o dia 10 de cada mês subsequente.</p>
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

          <TabsContent value="equipe" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <EquipeTabContent
              loadingTeam={loadingTeam}
              canManageTeam={canManageTeam}
              loadTeamMembers={loadTeamMembers}
              newMemberName={newMemberName}
              setNewMemberName={setNewMemberName}
              newMemberRole={newMemberRole}
              setNewMemberRole={setNewMemberRole}
              newMemberPin={newMemberPin}
              setNewMemberPin={setNewMemberPin}
              savingTeamMember={savingTeamMember}
              handleCreateTeamMember={handleCreateTeamMember}
              teamMembers={teamMembers}
              operatorProductivity={operatorProductivity}
              handleUpdateTeamMember={handleUpdateTeamMember}
              handleDeleteTeamMember={handleDeleteTeamMember}
              resetPins={resetPins}
              setResetPins={setResetPins}
            />
          </TabsContent>

          <TabsContent value="escolas360" className="m-0">
            <Escola360TabContent
              codigo={codigo}
              currentMemberId={memberId}
              schoolsList={schoolsList}
              crmLeads={crmLeads}
              supportTickets={supportTickets}
              commissionItems={commissionItems}
              partnerMembers={partnerMembers}
              onOpenSchoolDetails={handleOpenSchool360Details}
              onOpenLead={handleOpenLeadDrawer}
              onRegisterCall={handleRegisterSchool360Call}
            />
          </TabsContent>

          <TabsContent value="suporte" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SuporteTabContent
              loadingSupport={loadingSupport}
              savingSupportTicket={savingSupportTicket}
              supportTickets={supportTickets}
              supportSummary={supportSummary}
              schoolsList={schoolsList}
              partnerMembers={partnerMembers}
              newSupportSchoolToken={newSupportSchoolToken}
              setNewSupportSchoolToken={setNewSupportSchoolToken}
              newSupportSchoolName={newSupportSchoolName}
              setNewSupportSchoolName={setNewSupportSchoolName}
              newSupportTitle={newSupportTitle}
              setNewSupportTitle={setNewSupportTitle}
              newSupportDescription={newSupportDescription}
              setNewSupportDescription={setNewSupportDescription}
              newSupportCanal={newSupportCanal}
              setNewSupportCanal={setNewSupportCanal}
              newSupportCategoria={newSupportCategoria}
              setNewSupportCategoria={setNewSupportCategoria}
              newSupportGravidade={newSupportGravidade}
              setNewSupportGravidade={setNewSupportGravidade}
              newSupportResponsavelId={newSupportResponsavelId}
              setNewSupportResponsavelId={setNewSupportResponsavelId}
              supportUpdateNote={supportUpdateNote}
              setSupportUpdateNote={setSupportUpdateNote}
              supportEscalationReason={supportEscalationReason}
              setSupportEscalationReason={setSupportEscalationReason}
              loadSupportTickets={loadSupportTickets}
              handleCreateSupportTicket={handleCreateSupportTicket}
              handleUpdateSupportTicket={handleUpdateSupportTicket}
            />
          </TabsContent>

          <TabsContent value="pops" className="m-0">
            <PopsLibraryTabContent />
          </TabsContent>

          <TabsContent value="materiais" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <MateriaisTabContent
              assets={assets}
              copyToClipboard={copyToClipboard}
              codigo={codigo}
              campaignUrl={campaignUrl}
              onboardingUrl={onboardingUrl}
            />
          </TabsContent>
        </Tabs>

      {/* Modal Dialog for Registering Onboarding Call */}
      <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[32px] border-slate-200 bg-white p-8 shadow-xl">
          <DialogHeader>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Phone size={24} />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              Registrar Ligação de Cobrança
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre os detalhes do contato telefônico feito com a escola para follow-up das etapas de onboarding.
            </DialogDescription>
          </DialogHeader>

          {selectedSchoolForCall && (
            <div className="space-y-4 my-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Escola</label>
                <p className="text-sm font-bold text-slate-900">{selectedSchoolForCall.escola}</p>
              </div>

              {selectedSchoolForCall.steps && selectedSchoolForCall.steps.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Referente à Etapa</label>
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
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Notas da Conversa</label>
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
      <Dialog open={crmModalOpen} onOpenChange={handleCrmModalOpenChange}>
        <DialogContent className="sm:max-w-[500px] rounded-[32px] border-slate-200 bg-white p-8 shadow-xl">
          <DialogHeader>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
              <Target size={24} />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              Cadastrar Nova Escola (Lead)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Insira as informações do lead comercial para iniciar o acompanhamento de vendas no CRM da Klasse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4 max-h-[380px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3.5">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <label className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">Aproveitar lead do marketing</label>
                <select
                  value={selectedMarketingLeadId}
                  onChange={(e) => handleSelectMarketingLead(e.target.value)}
                  className="mt-2 block w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-amber-300 focus:outline-none cursor-pointer"
                >
                  <option value="">Cadastro manual</option>
                  {marketingLeads
                    .filter((lead) => !lead.crm_lead_id || lead.crm_lead_id === selectedMarketingLeadId)
                    .map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.escola} · {lead.nome} · score {lead.score ?? 0}
                      </option>
                    ))}
                </select>
                <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
                  Ao selecionar um lead do diagnóstico, o CRM vincula a origem e evita reconciliação manual depois.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Nome da Escola</label>
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
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Diretor / Decisor</label>
                  <input
                    type="text"
                    value={newLeadContactName}
                    onChange={(e) => setNewLeadContactName(e.target.value)}
                    placeholder="Ex: Dr. Eduardo Santos"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Telefone</label>
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
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">E-mail</label>
                <input
                  type="email"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  placeholder="Ex: coordenacao@escola.com"
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Responsável pelo Follow-up</label>
                <select
                  value={newLeadResponsavelId || memberId}
                  onChange={(e) => setNewLeadResponsavelId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none cursor-pointer"
                >
                  {(partnerMembers.length > 0 ? partnerMembers : [{ membro_id: memberId, membro_nome: memberName } as PartnerLoginMember]).map((member) => (
                    <option key={member.membro_id} value={member.membro_id}>
                      {member.membro_nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Segmento</label>
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
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Plano Estimado</label>
                  <select
                    value={newLeadPlan}
                    onChange={(e) => setNewLeadPlan(e.target.value as any)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                  {(() => {
                    const tiers = { essencial: 1, profissional: 2, premium: 3 };
                    const recommended = newLeadAlunos <= 600 ? "essencial" : newLeadAlunos <= 1500 ? "profissional" : "premium";
                    const isBelow = tiers[newLeadPlan] < tiers[recommended];
                    if (isBelow) {
                      return (
                        <p className="mt-1 text-[10px] font-bold text-amber-600">
                          ⚠️ Recomendado: Plano {recommended.charAt(0).toUpperCase() + recommended.slice(1)} para {newLeadAlunos} alunos.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Alunos Estimados</label>
                  <input
                    type="number"
                    value={newLeadAlunos}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNewLeadAlunos(val);
                      if (val <= 600) {
                        setNewLeadPlan("essencial");
                      } else if (val <= 1500) {
                        setNewLeadPlan("profissional");
                      } else {
                        setNewLeadPlan("premium");
                      }
                    }}
                    placeholder="Ex: 500"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Período de Degustação (Dias - Máx 30)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={newLeadTrialDays}
                    onChange={(e) => setNewLeadTrialDays(Math.min(30, Math.max(0, Number(e.target.value))))}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Taxa de Ativação (Kz)</label>
                  <input
                    type="number"
                    min={0}
                    value={newLeadTaxaAtivacao}
                    onChange={(e) => setNewLeadTaxaAtivacao(Math.max(0, Number(e.target.value)))}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Prazo da Ação</label>
                  <input
                    type="date"
                    value={newLeadActionDate}
                    onChange={(e) => setNewLeadActionDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-slate-300 focus:bg-white focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Próxima Ação Comercial</label>
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
          </div>

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              onClick={() => handleCrmModalOpenChange(false)}
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

      <OnboardingSchoolDetailsSheet
        open={detailsDrawerOpen}
        onOpenChange={setDetailsDrawerOpen}
        selectedSchoolForDetails={selectedSchoolForDetails}
        setSelectedSchoolForCall={setSelectedSchoolForCall}
        setSelectedStepCodeForCall={setSelectedStepCodeForCall}
        setCallModalOpen={setCallModalOpen}
        copyToClipboard={copyToClipboard}
        implantationChecklistDraft={implantationChecklistDraft}
        handleToggleImplantationItem={handleToggleImplantationItem}
        handleChangeImplantationNote={handleChangeImplantationNote}
        handleSaveImplantationChecklist={handleSaveImplantationChecklist}
        savingImplantationChecklist={savingImplantationChecklist}
        codigo={codigo}
        loadData={loadData}
      />

      <CrmLeadDetailsSheet
        open={crmLeadDrawerOpen}
        onOpenChange={setCrmLeadDrawerOpen}
        selectedCrmLead={selectedCrmLead}
        commercialPlan={commercialPlan}
        setCommercialPlan={setCommercialPlan}
        commercialAlunos={commercialAlunos}
        setCommercialAlunos={setCommercialAlunos}
        commercialTrialDays={commercialTrialDays}
        setCommercialTrialDays={setCommercialTrialDays}
        commercialTaxaAtivacao={commercialTaxaAtivacao}
        setCommercialTaxaAtivacao={setCommercialTaxaAtivacao}
        commercialMensalidade={commercialMensalidade}
        setCommercialMensalidade={setCommercialMensalidade}
        commercialPreset={commercialPreset}
        setCommercialPreset={setCommercialPreset}
        commercialNiveisEnsino={commercialNiveisEnsino}
        setCommercialNiveisEnsino={setCommercialNiveisEnsino}
        commercialSecretaria={commercialSecretaria}
        setCommercialSecretaria={setCommercialSecretaria}
        commercialFinanceiro={commercialFinanceiro}
        setCommercialFinanceiro={setCommercialFinanceiro}
        commercialPedagogico={commercialPedagogico}
        setCommercialPedagogico={setCommercialPedagogico}
        commercialStatus={commercialStatus}
        setCommercialStatus={setCommercialStatus}
        handleOpenCommercialProposal={handleOpenCommercialProposal}
        openingProposalFile={openingProposalFile}
        proposalDocumentFile={proposalDocumentFile}
        setProposalDocumentFile={setProposalDocumentFile}
        handleUploadCommercialProposal={handleUploadCommercialProposal}
        uploadingProposalFile={uploadingProposalFile}
        handleSaveCommercialTerms={handleSaveCommercialTerms}
        savingCommercialTerms={savingCommercialTerms}
        selectedStageToChange={selectedStageToChange}
        setSelectedStageToChange={setSelectedStageToChange}
        lossReasonText={lossReasonText}
        setLossReasonText={setLossReasonText}
        handleUpdateLeadStage={handleUpdateLeadStage}
        updatingLeadStage={updatingLeadStage}
        convertingLead={convertingLead}
        handleConvertLeadToOnboarding={handleConvertLeadToOnboarding}
        selectedLeadResponsavelId={selectedLeadResponsavelId}
        setSelectedLeadResponsavelId={setSelectedLeadResponsavelId}
        partnerMembers={partnerMembers}
        memberId={memberId}
        memberName={memberName}
        nextLeadAction={nextLeadAction}
        setNextLeadAction={setNextLeadAction}
        nextLeadActionDate={nextLeadActionDate}
        setNextLeadActionDate={setNextLeadActionDate}
        leadActionNotes={leadActionNotes}
        setLeadActionNotes={setLeadActionNotes}
        handleUpdateLeadAction={handleUpdateLeadAction}
        savingLeadAction={savingLeadAction}
        loadingHistory={loadingHistory}
        leadHistory={leadHistory}
      />
    </PartnerAppShell>
  );
}
