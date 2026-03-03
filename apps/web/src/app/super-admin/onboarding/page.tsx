"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  School, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MoreHorizontal, 
  ChevronRight, 
  Search, 
  Filter,
  Eye,
  Settings,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  ArrowRight,
  Database,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

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

// ─── Helpers Visuais ──────────────────────────────────────────────────────────
const STATUS_META = {
  pendente:       { label: "Pendente",      color: "bg-klasse-gold-100 text-klasse-gold-700 border-klasse-gold-200", dot: "bg-klasse-gold-500" },
  em_configuracao: { label: "Configuração",  color: "bg-slate-100 text-slate-700 border-slate-200",    dot: "bg-slate-500" },
  activo:         { label: "Activo",        color: "bg-klasse-green-100 text-klasse-green-700 border-klasse-green-200", dot: "bg-klasse-green-500" },
  cancelado:      { label: "Cancelado",     color: "bg-slate-100 text-slate-600 border-slate-200",  dot: "bg-slate-400" },
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
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const supabase = createClient();

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
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
    } catch (err: any) {
      toast.error("Erro ao carregar pedidos: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, supabase]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('onboarding_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Status actualizado para ${newStatus}`);
      loadRequests();
    } catch (err: any) {
      toast.error("Erro ao actualizar status: " + err.message);
    }
  };

  const filteredRequests = requests.filter(r => 
    r.escola_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.director_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedRequest = requests.find(r => r.id === selectedId);

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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Novas Candidaturas</h1>
            <p className="text-sm text-slate-500 font-medium">Controlo de entrada e provisionamento de novas escolas.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Buscar escola ou director..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green/30 outline-none w-64 transition-all"
              />
            </div>
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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Lista de Pedidos */}
          <div className="lg:col-span-2 space-y-4">
            {loading && !requests.length ? (
              <div className="flex flex-col items-center justify-center p-20 bg-white border border-slate-200 rounded-3xl space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-klasse-green" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando pedidos...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-20 text-center bg-white border border-slate-200 rounded-3xl">
                <School className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">Nenhum pedido de onboarding encontrado.</p>
              </div>
            ) : (
              filteredRequests.map(req => {
                const meta = STATUS_META[req.status] || STATUS_META.pendente;
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
          </div>

          {/* Detalhes do Pedido Seleccionado */}
          <div className="lg:col-span-1">
            {selectedRequest ? (
              <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-xl sticky top-24 bg-white animate-klasse-fade-in">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold text-slate-900">{selectedRequest.escola_nome}</CardTitle>
                    <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">×</button>
                  </div>
                  <CardDescription>Resumo dos dados de Onboarding</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  
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
                      onClick={() => toast.info("Provisionamento automático em desenvolvimento. Use o Wizard de Nova Escola por enquanto.")}
                      disabled={selectedRequest.status === 'activo'}
                    >
                      <Database size={16} />
                      PROVISIONAR ESCOLA
                    </Button>
                  </div>

                </CardContent>
              </Card>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-white/50">
                <Eye size={32} className="text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Seleccione um pedido para ver detalhes</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
