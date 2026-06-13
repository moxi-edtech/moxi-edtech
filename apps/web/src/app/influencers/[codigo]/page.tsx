"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
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
  Image as ImageIcon,
  Video,
  Copy,
  Download,
  ArrowRight,
  Megaphone,
  School,
  Send,
  Target
} from "lucide-react";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Database, Json } from "~types/supabase";

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
    escolas: {
      data: string;
      status: string;
      escola: string;
      plano: string | null;
      plano_label: string | null;
      total_alunos: string | null;
    }[];
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
  materiais: Json;
  stats: AfiliadoStats;
};

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campanha');
  const [authError, setAuthError] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const campaignUrl = `https://klasse.ao/escola-moderna?ref=${codigo}`;
  const onboardingUrl = `https://app.klasse.ao/onboarding?ref=${codigo}`;
  const onboardingStats = stats?.onboarding;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const storedAuth = sessionStorage.getItem(`klasse_influencer_auth:${codigo}`);
        const pin = storedAuth ? JSON.parse(storedAuth).pin : null;

        if (!pin) {
          setAuthError(true);
          return;
        }

        const [portalRes, assetsRes] = await Promise.all([
          (supabase.rpc as any)('get_influencer_portal', { p_codigo: codigo, p_pin: pin }),
          supabase.from('marketing_assets').select('*').eq('is_active', true)
        ]);

        if (portalRes.error || !portalRes.data || !isAfiliadoPortalResponse(portalRes.data) || !portalRes.data.ok) {
          setAuthError(true);
          return;
        }

        setStats(portalRes.data.stats);
        setAssets((assetsRes.data || []).filter(isMarketingAsset));
      } catch (err) {
        console.error(err);
        setAuthError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [codigo, supabase]);

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

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/influencers" className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-klasse-gold-100 text-klasse-gold-700 border-none font-black text-[10px] tracking-widest uppercase">Parceiro Oficial</Badge>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">•</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{codigo}</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Central de Campanha</h1>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Conversão</p>
              <p className="text-sm font-black text-slate-900">{stats?.total_diagnosticos ? ((stats.convertidos / stats.total_diagnosticos) * 100).toFixed(1) : 0}%</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6 space-y-8 mt-4">
        <Tabs defaultValue="campanha" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-200/50 p-1 rounded-2xl mb-8 inline-flex w-full md:w-auto">
            <TabsTrigger value="campanha" className="rounded-xl font-bold text-xs uppercase tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:text-slate-900 shadow-none py-3 flex-1 md:flex-none">
              Campanha
            </TabsTrigger>
            <TabsTrigger value="desempenho" className="rounded-xl font-bold text-xs uppercase tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:text-slate-900 shadow-none py-3 flex-1 md:flex-none">
              Funil
            </TabsTrigger>
            <TabsTrigger value="materiais" className="rounded-xl font-bold text-xs uppercase tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:text-slate-900 shadow-none py-3 flex-1 md:flex-none">
              Materiais
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="desempenho" className="m-0 space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
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
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
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
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
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
                  {onboardingStats.escolas.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                      <School className="mx-auto mb-4 h-10 w-10 text-slate-300" />
                      <p className="text-sm font-bold text-slate-400">Ainda nenhuma escola submeteu o pedido com este código.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {onboardingStats.escolas.map((escola, idx) => {
                        const status = ONBOARDING_STATUS_CONFIG[escola.status as keyof typeof ONBOARDING_STATUS_CONFIG] || ONBOARDING_STATUS_CONFIG.pendente;
                        return (
                          <div key={`${escola.escola}-${idx}`} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
                              <Badge className="border border-klasse-gold-200 bg-klasse-gold-100 text-[9px] font-black uppercase tracking-widest text-klasse-gold-700">
                                Plano: {escola.plano_label || escola.plano || "Não informado"}
                              </Badge>
                              <Badge className={`${status.color} border-none font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg`}>
                                <span className={`w-1 h-1 rounded-full ${status.dot} mr-2`} />
                                {status.label}
                              </Badge>
                            </div>
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
                  <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Escolas no funil</h3>
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
                <Card className="rounded-[32px] border-slate-900 bg-slate-900 text-white shadow-xl">
                  <CardHeader className="p-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="text-klasse-gold" />
                      Sua Comissão
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">A cada escola que você converter, você ganha 25% da primeira mensalidade paga.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total a Receber</p>
                      <p className="text-2xl font-black text-klasse-gold">Solicitar Fecho</p>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Os pagamentos são processados entre o dia 1 e 5 de cada mês.</p>
                  </CardContent>
                </Card>

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
      </main>
    </div>
  );
}
