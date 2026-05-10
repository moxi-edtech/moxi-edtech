"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  RefreshCw, Eye, Database, Download, CreditCard, UserPlus,
  GraduationCap, Presentation, MoreHorizontal,
  Phone, Mail, Calendar, ChevronRight, Activity, Users,
  School, FileText, Settings, StickyNote, TrendingUp,
  AlertTriangle, CheckCircle, Clock, Zap, BarChart3, ShieldCheck, XCircle,
  ArrowRight, Search
} from "lucide-react";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { createClient } from "@/lib/supabaseClient";
import type {
  EscolaDetalhes,
  EscolaMetricas,
  PerformanceMetrics,
  AtividadeRecente,
  PlanLimits,
} from "@/app/super-admin/escolas/[id]/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/Label";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtKz = (v: number) => {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' })
    .format(v)
    .replace('AOA', 'Kz');
};

const fmtHora = (ts: string) => {
  if (!ts) return "—";
  const d = new Date(ts), now = new Date();
  const diff = (now.getTime() - d.getTime()) / 36e5;
  if (diff < 0) return "agora";
  if (diff < (1/60)) return "segundos atrás";
  if (diff < 1)  return `${Math.round(diff*60)}min atrás`;
  if (diff < 24) return `${Math.round(diff)}h atrás`;
  return d.toLocaleDateString("pt-AO");
};

const TIPO_CONFIG: Record<string, { icon: any, colorClass: string, bgClass: string, label: string }> = {
  pagamento: { icon: CreditCard,    colorClass: "text-klasse-green", bgClass: "bg-klasse-green/10", label: "Pagamento"  },
  matricula: { icon: UserPlus,      colorClass: "text-klasse-gold",  bgClass: "bg-klasse-gold/10",  label: "Matrícula"  },
  nota:      { icon: GraduationCap, colorClass: "text-slate-600",    bgClass: "bg-slate-100",       label: "Notas"      },
  presenca:  { icon: Presentation,  colorClass: "text-slate-600",    bgClass: "bg-slate-100",       label: "Presença"   },
  config:    { icon: Settings,      colorClass: "text-slate-600",    bgClass: "bg-slate-50",        label: "Config"     },
  outro:     { icon: Activity,      colorClass: "text-slate-600",    bgClass: "bg-slate-50",        label: "Outro"      },
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SaudeRing({ valor }: { valor: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(valor), 400); return () => clearTimeout(t); }, [valor]);
  const barColor = v >= 80 ? "bg-klasse-green" : v >= 60 ? "bg-klasse-gold" : "bg-slate-400";

  return (
    <div className="min-w-[140px]">
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
        <span>Saúde</span>
        <span className="text-slate-700">{v}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${v}%` }}
          role="progressbar"
          aria-valuenow={v}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, main, sub, variant = "default", delay = 0 }: { icon: any, label: string, main: React.ReactNode, sub: string, variant?: "default" | "green" | "gold", delay?: number }) {
  const variants = {
    default: "border-slate-200 bg-white",
    green: "border-klasse-green/20 bg-klasse-green/5",
    gold: "border-klasse-gold/20 bg-klasse-gold/5",
  };

  const accents = {
    default: "bg-slate-100 text-slate-600",
    green: "bg-klasse-green/10 text-klasse-green",
    gold: "bg-klasse-gold/10 text-klasse-gold",
  };

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md animate-klasse-fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${accents[variant]}`}>
            <Icon size={16} />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        </div>
        <div className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
          {main}
        </div>
        <div className="text-xs text-slate-500 font-medium">{sub}</div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ item, i }: { item: AtividadeRecente, i: number }) {
  const cfg = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.outro;
  const Icon = cfg.icon;
  return (
    <div 
      className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 animate-klasse-fade-in"
      style={{ animationDelay: `${i * 50}ms` }}
    >
      <div className={`w-10 h-10 rounded-xl ${cfg.bgClass} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={cfg.colorClass} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">
          {item.descricao}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 font-medium">{item.usuario}</span>
          <span className="text-[10px] text-slate-300">•</span>
          <span className="text-[10px] text-slate-400 font-mono uppercase">{cfg.label}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
          <Clock size={10} />
          {fmtHora(item.timestamp)}
        </span>
      </div>
    </div>
  );
}

function NotasInternas({ escolaId }: { escolaId: string }) {
  const [nota, setNota]   = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(true);
  const timer = useRef<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/super-admin/escolas/${escolaId}/notes`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (json?.ok) setNota(json.nota ?? "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [escolaId]);

  const handleChange = (v: string) => {
    setNota(v); setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await fetch(`/api/super-admin/escolas/${escolaId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nota: v }),
        });
        setSaved(true);
      } catch (err) {
        console.error(err);
      }
    }, 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <StickyNote size={14} className="text-klasse-gold" />
          Notas Internas
        </h3>
        {loading ? (
          <RefreshCw size={12} className="animate-spin text-slate-300" />
        ) : (
          <span className={`text-[10px] font-bold uppercase ${saved ? "text-klasse-green" : "text-klasse-gold"}`}>
            {saved ? "✓ sincronizado" : "a guardar…"}
          </span>
        )}
      </div>
      <textarea
        value={nota}
        onChange={e => handleChange(e.target.value)}
        disabled={loading}
        placeholder="Apontamentos privados sobre esta escola..."
        className="w-full min-h-[120px] bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green/30 transition-all outline-none resize-none leading-relaxed"
      />
      <p className="text-[10px] text-slate-400 leading-tight">
        * Estas notas são visíveis apenas para a equipa do Super Admin.
      </p>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface EscolaMonitorProps {
  escola: EscolaDetalhes;
  metricas: EscolaMetricas;
  performance: PerformanceMetrics;
  atividades: AtividadeRecente[];
  saude: number;
  planLimits: PlanLimits[];
  refreshing: boolean;
  onRefresh: () => void;
  onUpdate: () => void;
}

export default function EscolaMonitor({
  escola,
  metricas,
  performance,
  atividades,
  saude,
  planLimits,
  refreshing,
  onRefresh,
  onUpdate,
}: EscolaMonitorProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const supabase = createClient();
  const dominioRaw = escola.dominio || escola.subdominio || null;
  const dominio = dominioRaw
    ? dominioRaw.includes('.')
      ? dominioRaw
      : `${dominioRaw}.klasse.ao`
    : null;
  const sslStatus = escola.ssl_status || null;
  const dbRegion = escola.db_region || null;

  const togglePortalAluno = async () => {
    const newStatus = !escola.aluno_portal_enabled;
    const ok = await confirm({
      title: `${newStatus ? "Activar" : "Desactivar"} Portal do Aluno`,
      message: `Deseja realmente ${newStatus ? "activar" : "desactivar"} o acesso ao Portal do Aluno para ${escola.nome}?`,
      confirmLabel: newStatus ? "Activar" : "Desactivar",
      variant: newStatus ? "default" : "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/super-admin/escolas/${escola.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { aluno_portal_enabled: newStatus }
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao actualizar escola');

      success("Estado actualizado", `O Portal do Aluno foi ${newStatus ? "activado" : "desactivado"} com sucesso.`);
      onUpdate();
    } catch (error: any) {
      toastError("Erro na actualização", "Não conseguimos alterar o estado do portal agora. Por favor, tente novamente.");
    }
  };

  const planOrder: Array<PlanLimits['plan']> = ["essencial", "profissional", "premium"];
  const planByTier = useMemo(() => {
    const map = new Map<PlanLimits['plan'], PlanLimits>();
    for (const plan of planLimits || []) {
      map.set(plan.plan, plan);
    }
    return map;
  }, [planLimits]);

  const alunosTotal = metricas?.alunos_total ?? 0;

  return (
    <div className="bg-slate-50 font-sans text-slate-900">
      
      {/* ── HEADER SUPERIOR ── */}
      <div className="bg-slate-50 px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-6">
            
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Super Admin</span>
              <ChevronRight size={10} />
              <span className="text-slate-300">Escolas</span>
              <ChevronRight size={10} />
              <span className="text-slate-500">{escola.nome}</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              
              {/* Identidade */}
              <div className="flex items-start gap-6">
                <div className="space-y-3">
                  <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                      {escola.nome}
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Escola ID: <span className="font-mono text-[11px] text-slate-400">{escola.id}</span></p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-klasse-green/5 text-klasse-green border-klasse-green/20 font-semibold uppercase text-[9px] px-2.5 py-0.5 rounded-full">
                      Plano {escola.plano_atual}
                    </Badge>
                    <Badge className={`${escola.status === 'ativa' ? 'bg-klasse-green/10 text-klasse-green border-klasse-green/20' : 'bg-slate-100 text-slate-600 border-slate-200'} font-semibold uppercase text-[9px] px-2.5 py-0.5 rounded-full border`}>
                      {escola.status}
                    </Badge>
                    {escola.aluno_portal_enabled && (
                      <Badge className="bg-klasse-green text-white font-semibold uppercase text-[9px] px-2.5 py-0.5 rounded-full border-0">
                        Portal Ativo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="flex flex-col items-stretch md:items-end gap-3">
                <div className="w-full md:w-52">
                  <SaudeRing valor={saude} />
                </div>
                
                <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
                  <Button 
                    onClick={onRefresh} 
                    disabled={refreshing}
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl font-semibold text-xs gap-2 border-slate-200"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    Actualizar Dados
                  </Button>
                  <Button 
                    onClick={() => window.open(`/escola/${escola.id}/admin`, '_blank')}
                    variant="default" 
                    size="sm" 
                    className="bg-klasse-green hover:bg-klasse-green/90 text-white rounded-xl font-semibold text-xs gap-2 shadow-sm"
                  >
                    <Eye size={14} />
                    Entrar como Escola
                  </Button>
                </div>
              </div>
            </div>

            {/* Contactos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="p-2 rounded-lg bg-slate-50"><Mail size={14} /></div>
                <span className="text-sm font-medium">{escola.email || "Sem email registado"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="p-2 rounded-lg bg-slate-50"><Phone size={14} /></div>
                <span className="text-sm font-medium">{escola.telefone || "Sem telefone registado"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="p-2 rounded-lg bg-slate-50"><Calendar size={14} /></div>
                <span className="text-sm font-medium tracking-tight">Membro desde {new Date(escola.created_at).toLocaleDateString("pt-AO", { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="max-w-6xl mx-auto p-6 space-y-8 animate-klasse-fade-in">
        
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard 
            icon={Users} label="Alunos Activos" delay={0}
            main={metricas.alunos_ativos.toLocaleString("pt-AO")}
            sub={`${metricas.alunos_inativos} inactivos · ${metricas.inadimplentes} c/ dívida`}
            variant="green"
          />
          <MetricCard 
            icon={School} label="Estrutura Académica" delay={100}
            main={`${metricas.professores} Professores`}
            sub={`${metricas.turmas_ativas} turmas · ${metricas.matriculas_ativas} matrículas`}
            variant="gold"
          />
          <MetricCard 
            icon={CreditCard} label="Receita Arrecadada" delay={200}
            main={fmtKz(metricas.valor_pago)}
            sub={`${fmtKz(metricas.valor_pendente)} em aberto`}
            variant="default"
          />
          <MetricCard 
            icon={Zap} label="Performance Global" delay={300}
            main={`${performance.latencia_media || 0}ms`}
            sub={`${performance.accessos_24h} acessos em 24h`}
            variant="gold"
          />
        </div>

        {/* TABS E DETALHES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-slate-200/50 p-1 rounded-2xl border-0">
                  <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wider px-6">Geral</TabsTrigger>
                  <TabsTrigger value="atividades" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wider px-6">Actividade</TabsTrigger>
                  <TabsTrigger value="config" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wider px-6">Config</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-0 focus-visible:ring-0">
                <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg">Diagnóstico do Sistema</CardTitle>
                        <CardDescription>Métricas de saúde técnica e sincronização</CardDescription>
                      </div>
                      <Badge className="bg-klasse-green/10 text-klasse-green hover:bg-klasse-green/10 border-klasse-green/20 uppercase font-bold text-[10px]">
                        Sistema Saudável
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-2 border-b border-slate-100">
                      <div className="p-6 border-r border-slate-100 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização</p>
                        <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${performance.sync_status === 'error' ? 'bg-klasse-gold' : 'bg-klasse-green animate-pulse'}`} />
                          {performance.sync_status?.toUpperCase() || "OK"}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Última: {new Date(performance.sync_updated_at).toLocaleString()}</p>
                      </div>
                      <div className="p-6 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Uptime Médio</p>
                        <p className="text-xl font-bold text-slate-900">99.98%</p>
                        <p className="text-[10px] text-klasse-green font-bold uppercase tracking-tight">SLA Profissional</p>
                      </div>
                    </div>
                    <div className="p-6">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Uso de Recursos (MB)</h4>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-klasse-green w-[42%] rounded-full" />
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                        <span>STORAGE: 1.2 GB USADO</span>
                        <span>LIMITE: 5.0 GB</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-sm mt-6">
                  <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Limite de alunos por plano</CardTitle>
                        <CardDescription>Uso actual e margem para upgrade</CardDescription>
                      </div>
                      <Badge className="bg-slate-800 text-white hover:bg-slate-800 border-0 uppercase font-bold text-[10px]">
                        {alunosTotal} alunos activos
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid gap-4">
                      {planOrder.map((tier) => {
                        const limits = planByTier.get(tier);
                        const max = limits?.max_alunos ?? null;
                        const remaining = max === null ? null : Math.max(0, max - alunosTotal);
                        const isCurrent = escola.plano_atual === tier;
                        return (
                          <div key={tier} className={`flex flex-col gap-2 rounded-2xl border ${isCurrent ? 'border-klasse-green/40 bg-klasse-green/5' : 'border-slate-200 bg-white'} p-4`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{tier}</span>
                                {isCurrent && (
                                  <Badge className="bg-klasse-green text-white border-0 text-[9px] font-bold uppercase">Plano actual</Badge>
                                )}
                              </div>
                              <span className="text-xs font-semibold text-slate-700">
                                {max === null ? "Ilimitado" : `Limite ${max}`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-700">
                              <span>Alunos actuais: <strong>{alunosTotal}</strong></span>
                              <span>
                                {remaining === null ? "Sem limite" : `Faltam ${remaining}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="atividades" className="mt-0 focus-visible:ring-0">
                <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-slate-100">
                    {atividades.length > 0 ? (
                      atividades.map((a, i) => <ActivityRow key={a.id} item={a} i={i} />)
                    ) : (
                      <div className="p-12 text-center space-y-3">
                        <Activity size={40} className="mx-auto text-slate-200" />
                        <p className="text-sm text-slate-400 font-medium">Nenhuma actividade recente para mostrar.</p>
                      </div>
                    )}
                  </div>
                  {atividades.length > 0 && (
                    <div className="bg-slate-50/50 p-4 border-t border-slate-100 text-center">
                      <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-500 hover:text-klasse-green">
                        Carregar mais actividades
                        <ArrowRight size={14} className="ml-2" />
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="config" className="mt-0 focus-visible:ring-0">
                <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <CardTitle className="text-lg font-bold">Gestão de Funções</CardTitle>
                    <CardDescription>Activar ou desactivar módulos centrais da escola</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl hover:border-klasse-green/30 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-sm font-bold text-slate-900">Portal do Aluno</Label>
                        <p className="text-xs text-slate-500 font-medium">Permite que alunos consultem notas e paguem propinas online.</p>
                      </div>
                      <Switch 
                        checked={escola.aluno_portal_enabled} 
                        onCheckedChange={togglePortalAluno}
                        className="data-[state=checked]:bg-klasse-green"
                      />
                    </div>

                    <div className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl opacity-60 grayscale cursor-not-allowed">
                      <div className="space-y-1">
                        <Label className="text-sm font-bold text-slate-900">Módulo de Mensagens SMS</Label>
                        <p className="text-xs text-slate-500 font-medium text-klasse-gold font-bold uppercase tracking-tighter">Upgrade Necessário</p>
                      </div>
                      <Switch disabled checked={false} />
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <h4 className="text-[10px] font-bold text-klasse-gold uppercase tracking-[0.2em] mb-4">Zona de Perigo</h4>
                      <div className="p-5 bg-klasse-gold/10 border border-klasse-gold/20 rounded-2xl flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900">Resetar Escola</p>
                          <p className="text-xs text-slate-600 font-medium">Esta acção apaga todos os dados e não pode ser desfeita.</p>
                        </div>
                        <Button variant="destructive" size="sm" className="rounded-xl font-bold text-xs" onClick={() => toastError("Acção bloqueada", "Protegido por MFA de Supervisor")}>
                          Resetar Dados
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="bg-klasse-gold/5 border-b border-klasse-gold/10 p-6">
                <CardTitle className="text-lg font-bold text-slate-900">Gestão Interna</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <NotasInternas escolaId={escola.id} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Painel de Acesso</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Domínio</span>
                  <span className={dominio ? "text-slate-900 font-bold tracking-tight" : "text-slate-400 font-semibold"}>
                    {dominio || "Não configurado"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">SSL Status</span>
                  {sslStatus ? (
                    <span className="text-klasse-green font-bold flex items-center gap-1">
                      <ShieldCheck size={14} /> {sslStatus}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-semibold">Não informado</span>
                  )}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">DB Region</span>
                  <span className={dbRegion ? "text-slate-900 font-bold" : "text-slate-400 font-semibold"}>
                    {dbRegion || "Não informado"}
                  </span>
                </div>
              </div>
              <Button variant="outline" fullWidth className="rounded-xl font-bold text-xs border-slate-200 hover:bg-slate-50">
                Ver Logs de Infraestrutura
              </Button>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}
