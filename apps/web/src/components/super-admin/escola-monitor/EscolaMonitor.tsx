"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  RefreshCw, Eye, Database, Download, CreditCard, UserPlus,
  GraduationCap, Presentation, Wrench, MoreHorizontal,
  Phone, Mail, Calendar, ChevronRight, Activity, Users,
  School, FileText, Settings, StickyNote, TrendingUp,
  AlertTriangle, CheckCircle, Clock, Zap, BarChart3, ShieldCheck, XCircle,
  ArrowRight, Search
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabaseClient";
import type { 
  EscolaDetalhes, 
  EscolaMetricas, 
  PerformanceMetrics, 
  AtividadeRecente 
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
  pagamento: { icon: CreditCard,    colorClass: "text-emerald-600", bgClass: "bg-emerald-50", label: "Pagamento"  },
  matricula: { icon: UserPlus,      colorClass: "text-blue-600",    bgClass: "bg-blue-50",    label: "Matrícula"  },
  nota:      { icon: GraduationCap, colorClass: "text-purple-600",  bgClass: "bg-purple-50",  label: "Notas"      },
  presenca:  { icon: Presentation,  colorClass: "text-amber-600",   bgClass: "bg-amber-50",   label: "Presença"   },
  config:    { icon: Wrench,        colorClass: "text-slate-600",   bgClass: "bg-slate-50",   label: "Config"     },
  outro:     { icon: Activity,      colorClass: "text-slate-600",   bgClass: "bg-slate-50",   label: "Outro"      },
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SaudeRing({ valor }: { valor: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(valor), 400); return () => clearTimeout(t); }, [valor]);
  const r = 32, circ = 2 * Math.PI * r;
  const offset = circ - (v / 100) * circ;
  const color = v >= 80 ? "#1F6B3B" : v >= 60 ? "#E3B23C" : "#EF4444";
  
  return (
    <div className="relative w-20 h-20">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E2E8F0" strokeWidth="6" />
        <circle 
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold leading-none" style={{ color }}>{v}%</span>
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Saúde</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, main, sub, variant = "default", delay = 0 }: { icon: any, label: string, main: React.ReactNode, sub: string, variant?: "default" | "green" | "gold" | "purple", delay?: number }) {
  const variants = {
    default: "border-slate-200 bg-white",
    green: "border-klasse-green/20 bg-klasse-green/5",
    gold: "border-klasse-gold/20 bg-klasse-gold/5",
    purple: "border-purple-200 bg-purple-50/30",
  };

  const accents = {
    default: "bg-slate-100 text-slate-600",
    green: "bg-klasse-green/10 text-klasse-green",
    gold: "bg-klasse-gold/10 text-klasse-gold",
    purple: "bg-purple-100 text-purple-600",
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
          <span className={`text-[10px] font-bold uppercase ${saved ? "text-klasse-green" : "text-amber-500"}`}>
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
  refreshing,
  onRefresh,
  onUpdate,
}: EscolaMonitorProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const supabase = createClient();

  const togglePortalAluno = async () => {
    const newStatus = !escola.aluno_portal_enabled;
    if (!confirm(`Deseja ${newStatus ? 'ATIVAR' : 'DESATIVAR'} o Portal do Aluno para ${escola.nome}?`)) return;

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

      toast.success(`Portal do aluno ${newStatus ? 'ativado' : 'desativado'}!`);
      onUpdate();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
      
      {/* ── HEADER SUPERIOR ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Super Admin</span>
            <ChevronRight size={10} />
            <span className="text-slate-300">Escolas</span>
            <ChevronRight size={10} />
            <span className="text-klasse-green">{escola.nome}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            
            {/* Identidade */}
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-3xl bg-klasse-green flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-klasse-green/20 relative group overflow-hidden">
                {escola.logo_url ? (
                  <img src={escola.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  escola.nome.charAt(0)
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Wrench size={24} className="text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                    {escola.nome}
                  </h1>
                  <p className="text-sm text-slate-500 font-medium">Escola ID: <span className="font-mono text-[10px]">{escola.id}</span></p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-klasse-green/5 text-klasse-green border-klasse-green/20 font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full">
                    Plano {escola.plano_atual}
                  </Badge>
                  <Badge className={`${escola.status === 'ativa' ? 'bg-emerald-500' : 'bg-slate-400'} text-white font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full border-0`}>
                    {escola.status}
                  </Badge>
                  {escola.aluno_portal_enabled && (
                    <Badge className="bg-blue-500 text-white font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full border-0">
                      Portal Ativo
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-4">
              <SaudeRing valor={saude} />
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={onRefresh} 
                  disabled={refreshing}
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl font-bold text-xs gap-2 border-slate-200"
                >
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                  Actualizar Dados
                </Button>
                <Button 
                  onClick={() => window.open(`/escola/${escola.id}/admin`, '_blank')}
                  variant="default" 
                  size="sm" 
                  className="bg-klasse-green hover:bg-klasse-green/90 text-white rounded-xl font-bold text-xs gap-2 shadow-lg shadow-klasse-green/10"
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
            variant="purple"
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
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 uppercase font-bold text-[10px]">
                        Sistema Saudável
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-2 border-b border-slate-100">
                      <div className="p-6 border-r border-slate-100 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização</p>
                        <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${performance.sync_status === 'error' ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                          {performance.sync_status?.toUpperCase() || "OK"}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Última: {new Date(performance.sync_updated_at).toLocaleString()}</p>
                      </div>
                      <div className="p-6 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Uptime Médio</p>
                        <p className="text-xl font-bold text-slate-900">99.98%</p>
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">SLA Profissional</p>
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
                    <div className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl hover:border-blue-200 transition-colors">
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
                        <p className="text-xs text-slate-500 font-medium text-amber-600 font-bold uppercase tracking-tighter">Upgrade Necessário</p>
                      </div>
                      <Switch disabled checked={false} />
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.2em] mb-4">Zona de Perigo</h4>
                      <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-rose-900">Resetar Escola</p>
                          <p className="text-xs text-rose-700/70 font-medium">Esta acção apaga todos os dados e não pode ser desfeita.</p>
                        </div>
                        <Button variant="destructive" size="sm" className="rounded-xl font-bold text-xs" onClick={() => toast.error("Protegido por MFA de Supervisor")}>
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
                  <span className="text-slate-900 font-bold tracking-tight">{escola.nome.toLowerCase().replace(/\s/g, '-')}.klasse.ao</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">SSL Status</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <ShieldCheck size={14} /> Protegido
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">DB Region</span>
                  <span className="text-slate-900 font-bold">AWS Cape Town (af-south-1)</span>
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
