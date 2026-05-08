"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  Check, 
  X, 
  Key, 
  Lock, 
  Unlock, 
  RefreshCw, 
  MoreHorizontal,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Calendar,
  Clock,
  Printer,
  Mail,
  MessageSquare,
  ChevronRight,
  UserCheck,
  UserMinus,
  AlertTriangle
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useGestaoAcessos, AlunoAcesso } from "@/hooks/useGestaoAcessos";
import { useLimitesPlano } from "@/hooks/useLimitesPlano";
import { useTurmas } from "@/hooks/useTurmas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  escolaId: string;
};

type TabType = "pendentes" | "ativos" | "bloqueados";

export function AcessoPortalManager({ escolaId }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("pendentes");
  const [search, setSearch] = useState("");
  const [turmaId, setTurmaId] = useState<string>("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  
  const { items, loading, error, refetch } = useGestaoAcessos({ 
    escolaId, 
    tab: activeTab, 
    search, 
    turmaId: turmaId || null 
  });

  const { licencasUsadas, licencasTotais, loading: loadingLimites } = useLimitesPlano(escolaId);
  const { turmas } = useTurmas(escolaId);

  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [liberados, setLiberados] = useState<any[]>([]);

  const licencasDisponiveis =
    licencasTotais === null ? Number.POSITIVE_INFINITY : Math.max(0, licencasTotais - licencasUsadas);
  const licencasTotaisLabel = licencasTotais === null ? "Ilimitado" : String(licencasTotais);
  const licencasDisponiveisLabel =
    licencasTotais === null ? "∞" : String(Math.max(0, licencasTotais - licencasUsadas));

  // Limpar seleção ao trocar de aba
  useEffect(() => {
    setSelecionados([]);
    setLiberados([]);
    setActionMessage(null);
  }, [activeTab]);

  const toggleSelecionar = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    if (activeTab === "pendentes") {
      const limiteSeguro = items.slice(0, licencasDisponiveis);
      setSelecionados(limiteSeguro.map((a) => a.id));
    } else {
      setSelecionados(items.map((a) => a.id));
    }
  };

  const limparSelecao = () => setSelecionados([]);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'email' | 'print'>('whatsapp');

  const handleAction = async (action: 'gerar' | 'bloquear' | 'restaurar' | 'reset-senha') => {
    if (selecionados.length === 0) return;
    
    if (action === 'bloquear' && !showBlockModal) {
      setShowBlockModal(true);
      return;
    }

    if (action === 'gerar' && !showDistributionModal) {
      setShowDistributionModal(true);
      return;
    }

    setSubmitting(true);
    setActionMessage(null);
    if (action === 'bloquear') setShowBlockModal(false);
    if (action === 'gerar') setShowDistributionModal(false);

    try {
      let res;
      if (action === 'gerar') {
        if (selecionados.length > licencasDisponiveis) {
          throw new Error("A seleção excede o limite do seu plano atual.");
        }
        res = await fetch('/api/secretaria/alunos/liberar-acesso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            escolaId, 
            alunoIds: selecionados, 
            canal: selectedChannel, 
            gerarCredenciais: true 
          }),
        });
      } else {
        res = await fetch('/api/secretaria/alunos/gerir-acesso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            escolaId, 
            alunoIds: selecionados, 
            action,
            motivo: action === 'bloquear' ? blockReason : undefined
          }),
        });
      }

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao processar ação');

      if (action === 'gerar') {
        setLiberados(Array.isArray(json.detalhes) ? json.detalhes : []);
        setActionMessage({ type: 'success', text: `${json.liberados} aluno(s) tiveram acesso liberado.` });
      } else {
        setActionMessage({ type: 'success', text: "Ação executada com sucesso." });
      }
      
      setBlockReason("");
      limparSelecao();
      refetch();
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e.message || 'Erro ao processar' });
    } finally {
      setSubmitting(false);
    }
  };

  const isOverLimit = activeTab === "pendentes" && selecionados.length > licencasDisponiveis;

  return (
    <div className="space-y-6">
      {/* Header & Estatísticas */}
      <Card className="rounded-xl shadow-sm border-slate-200 overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#1F6B3B]">
              <Users className="w-6 h-6" />
              Gestor de Acessos ao Portal
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1 font-sora">
              Controle o ciclo de vida das contas dos alunos e distribuição de credenciais.
            </p>
          </div>
          
          {!loadingLimites && (
            <div className="flex flex-col items-end rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Licenças Disponíveis</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${licencasTotais !== null && licencasDisponiveis <= 5 ? 'text-rose-600' : 'text-[#E3B23C]'}`}>
                  {licencasDisponiveisLabel}
                </span>
                <span className="text-sm text-slate-500 font-medium">/ {licencasTotaisLabel}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-[#E3B23C] h-full transition-all duration-500" 
                  style={{ width: `${licencasTotais ? (licencasUsadas / licencasTotais) * 100 : 0}%` }}
                />
              </div>
              <span className="mt-1.5 text-[10px] text-slate-500 font-medium">Usadas: {licencasUsadas}</span>
            </div>
          )}
        </div>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
            <div className="px-6 pt-4 border-b border-slate-100">
              <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start border-none">
                <TabsTrigger 
                  value="pendentes" 
                  className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E3B23C] data-[state=active]:bg-transparent data-[state=active]:text-[#E3B23C] data-[state=active]:shadow-none font-bold text-slate-500"
                >
                  Pendentes
                </TabsTrigger>
                <TabsTrigger 
                  value="ativos" 
                  className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E3B23C] data-[state=active]:bg-transparent data-[state=active]:text-[#E3B23C] data-[state=active]:shadow-none font-bold text-slate-500"
                >
                  Ativos
                </TabsTrigger>
                <TabsTrigger 
                  value="bloqueados" 
                  className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E3B23C] data-[state=active]:bg-transparent data-[state=active]:text-[#E3B23C] data-[state=active]:shadow-none font-bold text-slate-500"
                >
                  Bloqueados
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Filtros */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/30">
              <div className="relative">
                <Search className="absolute left-3 top-[42px] w-4 h-4 text-slate-400" />
                <Input 
                  label="Pesquisar"
                  placeholder="Nome ou processo..." 
                  className="pl-10 rounded-xl border-slate-200"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select 
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
                className="rounded-xl border-slate-200"
                options={[
                  { value: "", label: "Todas as Turmas" },
                  ...(turmas?.map(t => ({ value: t.id, label: `${t.nome} (${t.turma_codigo})` })) || [])
                ]}
              />
              <div className="flex items-center gap-2">
                 <Button variant="outline" className="rounded-xl flex-1" onClick={selecionarTodos}>
                   Selecionar Todos
                 </Button>
                 {selecionados.length > 0 && (
                   <Button variant="ghost" className="rounded-xl text-slate-500" onClick={limparSelecao}>
                     Limpar ({selecionados.length})
                   </Button>
                 )}
              </div>
            </div>

            <div className="px-6 pb-24 min-h-[400px]">
              {/* Alertas */}
              {actionMessage && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${
                  actionMessage.type === 'success' 
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}>
                  {actionMessage.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-semibold">{actionMessage.text}</span>
                  <button onClick={() => setActionMessage(null)} className="ml-auto">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {isOverLimit && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 mb-6">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="text-sm font-semibold">
                    Atenção: Selecionou mais alunos ({selecionados.length}) do que o seu plano permite ({licencasDisponiveisLabel}).
                  </span>
                </div>
              )}

              {/* Lista de Alunos */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#E3B23C]" />
                  <p className="text-sm font-medium">Carregando alunos...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    <Users className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">Nenhum aluno encontrado nesta aba.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                  {items.map((aluno) => {
                    const isActive = selecionados.includes(aluno.id);
                    return (
                      <div
                        key={aluno.id}
                        onClick={() => toggleSelecionar(aluno.id)}
                        className={`group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${
                          isActive 
                            ? 'border-[#E3B23C] bg-white ring-2 ring-[#E3B23C]/10 shadow-md' 
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{aluno.nome}</h3>
                            <p className="text-xs text-slate-500 font-medium">Proc: {aluno.numero_processo || '—'}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isActive ? 'bg-[#E3B23C] border-[#E3B23C]' : 'border-slate-300 group-hover:border-[#E3B23C]'
                          }`}>
                            {isActive && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {activeTab === 'pendentes' && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg w-fit">
                              <Calendar className="w-3 h-3" />
                              Criado em: {aluno.created_at ? format(new Date(aluno.created_at), "dd/MM/yyyy") : '—'}
                            </div>
                          )}

                          {activeTab === 'ativos' && (
                            <>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg w-fit">
                                <Clock className="w-3 h-3" />
                                Último Login: {aluno.last_login ? format(new Date(aluno.last_login), "dd/MM/yyyy HH:mm") : 'Nunca logou'}
                              </div>
                              {aluno.data_ativacao && (
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 ml-1">
                                  <UserCheck className="w-3 h-3 text-emerald-500" />
                                  Ativado em: {format(new Date(aluno.data_ativacao), "dd/MM/yyyy")}
                                </div>
                              )}
                              {aluno.inadimplente && (
                                <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] mt-2">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Débito: {aluno.dias_atraso} dias
                                </Badge>
                              )}
                            </>
                          )}

                          {activeTab === 'bloqueados' && (
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5">
                              <p className="text-[10px] font-bold text-rose-900 uppercase tracking-wider mb-1">Motivo do Bloqueio</p>
                              <p className="text-xs text-rose-800 line-clamp-2 italic">"{aluno.motivo_bloqueio || 'Bloqueio administrativo'}"</p>
                              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-rose-100/50">
                                {aluno.bloqueado_em && (
                                  <p className="text-[10px] text-rose-600/70 font-medium">
                                    {format(new Date(aluno.bloqueado_em), "dd/MM/yyyy")}
                                  </p>
                                )}
                                {aluno.bloqueado_por_nome && (
                                  <p className="text-[10px] text-rose-600/70 font-bold uppercase">
                                    Por: {aluno.bloqueado_por_nome.split(' ')[0]}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal de Motivo de Bloqueio */}
      {showBlockModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-bold text-slate-900">Bloquear Acesso</h3>
              <button onClick={() => setShowBlockModal(false)} className="rounded-xl p-2 hover:bg-slate-50 transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 font-medium">
                  O acesso ao portal será interrompido imediatamente para os {selecionados.length} alunos selecionados.
                </p>
              </div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Motivo do Bloqueio</label>
              <textarea 
                className="w-full rounded-xl border-slate-200 focus:ring-[#E3B23C] focus:border-[#E3B23C] min-h-[100px] text-sm p-3"
                placeholder="Ex: Pendência financeira, mau comportamento digital, etc..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="ghost" className="rounded-xl" onClick={() => setShowBlockModal(false)}>
                Cancelar
              </Button>
              <Button 
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-6"
                onClick={() => handleAction('bloquear')}
                disabled={!blockReason.trim() || submitting}
              >
                Confirmar Bloqueio
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Distribuição de Credenciais */}
      {showDistributionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-bold text-slate-900">Gerar e Enviar Acessos</h3>
              <button onClick={() => setShowDistributionModal(false)} className="rounded-xl p-2 hover:bg-slate-50 transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-6">
                Como deseja distribuir as credenciais para os {selecionados.length} alunos?
              </p>
              
              <div className="space-y-3">
                {[
                  { id: 'whatsapp', label: 'WhatsApp (Automático)', icon: MessageSquare, desc: 'Envia via bot do sistema' },
                  { id: 'email', label: 'E-mail', icon: Mail, desc: 'Envia para o e-mail cadastrado' },
                  { id: 'print', label: 'Apenas Gerar (Imprimir)', icon: Printer, desc: 'Gera PDF com slips de acesso' },
                ].map((channel) => (
                  <label 
                    key={channel.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedChannel === channel.id 
                        ? 'border-[#E3B23C] bg-white ring-2 ring-[#E3B23C]/10' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="channel" 
                      className="mt-1 accent-[#E3B23C]" 
                      checked={selectedChannel === channel.id}
                      onChange={() => setSelectedChannel(channel.id as any)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <channel.icon className={`w-4 h-4 ${selectedChannel === channel.id ? 'text-[#E3B23C]' : 'text-slate-400'}`} />
                        <span className="text-sm font-bold text-slate-900">{channel.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{channel.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="ghost" className="rounded-xl" onClick={() => setShowDistributionModal(false)}>
                Cancelar
              </Button>
              <Button 
                className="bg-[#E3B23C] hover:bg-[#D4A134] text-white rounded-xl px-8"
                onClick={() => handleAction('gerar')}
                disabled={submitting}
              >
                Gerar Acessos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar (FAB) */}
      {selecionados.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-slate-700/50 backdrop-blur-md">
            <div className="flex items-center gap-4 pl-2">
              <div className="bg-[#E3B23C] text-white rounded-xl px-3 py-1.5 text-sm font-bold shadow-lg shadow-[#E3B23C]/20">
                {selecionados.length} selecionados
              </div>
              <div className="h-8 w-px bg-slate-700" />
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'pendentes' && (
                <Button 
                  className="bg-[#E3B23C] hover:bg-[#D4A134] text-white rounded-xl h-11 px-6 shadow-lg shadow-[#E3B23C]/10 border-none transition-all active:scale-95"
                  onClick={() => handleAction('gerar')}
                  disabled={submitting || isOverLimit}
                  loading={submitting}
                >
                  <Key className="w-4 h-4 mr-2" />
                  Gerar Acessos
                </Button>
              )}

              {activeTab === 'ativos' && (
                <>
                  <Button 
                    variant="ghost"
                    className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl h-11"
                    onClick={() => handleAction('reset-senha')}
                    disabled={submitting}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${submitting ? 'animate-spin' : ''}`} />
                    Resetar Senha
                  </Button>
                  <Button 
                    className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-11 px-6 shadow-lg shadow-rose-900/20 border-none transition-all active:scale-95"
                    onClick={() => handleAction('bloquear')}
                    disabled={submitting}
                    loading={submitting}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Bloquear
                  </Button>
                </>
              )}

              {activeTab === 'bloqueados' && (
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 shadow-lg shadow-emerald-900/20 border-none transition-all active:scale-95"
                  onClick={() => handleAction('restaurar')}
                  disabled={submitting}
                  loading={submitting}
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Restaurar Acesso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bloco de Credenciais Geradas (Exibir quando houver) */}
      {liberados.length > 0 && (
        <Card className="rounded-2xl border-[#E3B23C]/30 bg-[#E3B23C]/5 shadow-sm overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="p-5 border-b border-[#E3B23C]/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#E3B23C] p-2 rounded-xl">
                <Key className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Credenciais Geradas com Sucesso</h3>
                <p className="text-xs text-slate-500 font-medium">Os alunos agora podem acessar o portal com os dados abaixo.</p>
              </div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" className="rounded-xl border-slate-200 bg-white">
                 <Printer className="w-4 h-4 mr-2 text-[#E3B23C]" />
                 Imprimir Slips
               </Button>
               <Button variant="ghost" size="sm" className="rounded-xl text-slate-400" onClick={() => setLiberados([])}>
                 <X className="w-4 h-4" />
               </Button>
            </div>
          </div>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {liberados.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-white bg-white/60 p-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.nome ?? "Aluno"}</p>
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-200 text-emerald-700 bg-emerald-50">OK</Badge>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Usuário:</span>
                      <span className="font-mono font-bold text-[#E3B23C]">{item.login || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Senha:</span>
                      <span className="font-mono font-bold text-slate-700">{item.senha || "********"}</span>
                    </div>
                  </div>
                  {item.status === "bi_missing" && (
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-600 font-bold bg-rose-50 p-1.5 rounded-lg">
                      <AlertCircle className="w-3 h-3" />
                      BI não cadastrado
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
