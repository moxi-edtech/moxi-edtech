// apps/web/src/components/secretaria/BalcaoAtendimento.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, ShoppingCart, Printer, Trash2, 
  CreditCard, Banknote, AlertCircle, CheckCircle,
  FileText, Plus, Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client'; // Importar cliente Supabase para frontend
import { toast } from 'react-hot-toast'; // Para notificações de sucesso/erro
import { useDebounce } from '@/hooks/useDebounce'; // Assumindo useDebounce para a busca

const kwanza = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 });

// --- TIPOS (baseados nos dados reais do backend) ---
interface AlunoBusca {
  id: string;
  nome: string;
  numero_processo: string;
  bi_numero: string | null;
  turma: string;
  foto_url: string | null;
  matricula_id: string | null;
}

interface AlunoDossier extends AlunoBusca {
  status_financeiro: 'em_dia' | 'inadimplente';
  divida_total: number;
}

interface Mensalidade {
  id: string;
  nome: string; // Ex: "Mensalidade Mar/2025"
  preco: number;
  tipo: 'mensalidade';
  atrasada: boolean;
  mes_referencia: number;
  ano_referencia: number;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  tipo: 'servico';
  // Outros campos específicos do serviço
}

type ItemCarrinho = Mensalidade | Servico;

interface BalcaoAtendimentoProps {
  escolaId: string;
}

export default function BalcaoAtendimento({ escolaId }: BalcaoAtendimentoProps) {
  const supabase = createClient(); // Cliente Supabase para o frontend
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [alunosEncontrados, setAlunosEncontrados] = useState<AlunoBusca[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoDossier | null>(null);
  const [mensalidadesDisponiveis, setMensalidadesDisponiveis] = useState<Mensalidade[]>([]);
  const [servicosDisponiveis, setServicosDisponiveis] = useState<Servico[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [pagamento, setPagamento] = useState({ metodo: 'cash', valorRecebido: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [alunoDossierLoading, setAlunoDossierLoading] = useState(false);

  // --- Efeitos para Carregar Dados ---

  // Carregar Catálogo de Serviços
  useEffect(() => {
    async function loadServicos() {
      const { data, error } = await supabase
        .from('servicos_catalogo')
        .select('id, nome, preco, tipo')
        .eq('escola_id', escolaId)
        .eq('ativo', true);
      if (error) {
        console.error('Erro ao carregar serviços:', error);
        toast.error('Erro ao carregar serviços.');
      } else {
        setServicosDisponiveis(data as Servico[]);
      }
    }
    loadServicos();
  }, [supabase, escolaId]);

  // Carregar dados do aluno selecionado
  const loadAlunoDossier = useCallback(async (alunoId: string) => {
    setAlunoDossierLoading(true);
    const { data: dossier, error } = await supabase.rpc('get_aluno_dossier', {
      p_escola_id: escolaId, // Passa o escolaId real
      p_aluno_id: alunoId,
    });

    if (error || !dossier) {
      console.error('Erro ao carregar dossiê do aluno:', error);
      toast.error('Erro ao carregar detalhes do aluno.');
      setAlunoSelecionado(null);
      setMensalidadesDisponiveis([]);
    } else {
      const financeiro = (dossier as any).financeiro || {};
      const perfil = (dossier as any).perfil || {};
      const historico = (dossier as any).historico || [];

      const status_financeiro = (financeiro.total_em_atraso ?? 0) > 0 ? 'inadimplente' : 'em_dia';
      const divida_total = financeiro.total_em_atraso ?? 0;
      const turmaAtual = historico.find((h: any) => ['ativo', 'ativa'].includes(h.status_final)); // Assumindo status_final no historico

      setAlunoSelecionado({
        id: alunoId,
        nome: perfil.nome_completo || perfil.nome || 'Aluno Desconhecido',
        numero_processo: perfil.numero_processo || 'N/A',
        bi_numero: perfil.bi_numero || null,
        turma: turmaAtual?.turma || 'N/A',
        status_financeiro,
        divida_total,
        foto_url: perfil.foto_url,
        matricula_id: turmaAtual?.matricula_id || null,
      });

      // Mapear mensalidades para o formato do carrinho
      const mensalidades: Mensalidade[] = (financeiro.mensalidades || [])
        .filter((m: any) => m.status === 'pendente' || m.status === 'pago_parcial')
        .map((m: any) => ({
          id: m.id,
          nome: `Mensalidade ${new Date(0, m.mes_referencia - 1).toLocaleString('pt-PT', { month: 'short' })}/${m.ano_referencia}`,
          preco: (m.valor ?? 0) - (m.valor_pago_total ?? 0), // Preço líquido a pagar
          tipo: 'mensalidade',
          atrasada: m.data_vencimento ? new Date(m.data_vencimento) < new Date() : false,
          mes_referencia: m.mes,
          ano_referencia: m.ano_referencia,
        }));
      setMensalidadesDisponiveis(mensalidades);
      setCarrinho([]); // Limpa o carrinho ao mudar de aluno
      setPagamento({ metodo: 'cash', valorRecebido: 0 }); // Reseta pagamento
    }
    setAlunoDossierLoading(false);
  }, [supabase, escolaId]);

  // Busca de Alunos (debounce)
  useEffect(() => {
    async function searchAlunos() {
      if (!debouncedSearchTerm) {
        setAlunosEncontrados([]);
        return;
      }
      setIsSearching(true);
      const response = await fetch(`/api/secretaria/balcao/alunos/search?query=${debouncedSearchTerm}`);
      const data = await response.json();

      if (response.ok && data.ok) {
        setAlunosEncontrados(data.alunos);
      } else {
        console.error('Erro na busca:', data.error);
        setAlunosEncontrados([]);
      }
      setIsSearching(false);
    }
    searchAlunos();
  }, [debouncedSearchTerm]);


  // --- Lógica do Carrinho ---

  const adicionarAoCarrinho = (item: ItemCarrinho) => {
    // Para mensalidades, verificar se já existe uma do mesmo mês/ano
    if (item.tipo === 'mensalidade') {
      if (carrinho.some(
        c => c.tipo === 'mensalidade' &&
        (c as Mensalidade).mes_referencia === (item as Mensalidade).mes_referencia &&
        (c as Mensalidade).ano_referencia === (item as Mensalidade).ano_referencia
      )) {
        toast('Mensalidade já está no carrinho.');
        return;
      }
    }
    // Para serviços, verificar se já existe um serviço com o mesmo ID
    if (item.tipo === 'servico') {
      if (carrinho.some(c => c.tipo === 'servico' && c.id === item.id)) {
        toast('Serviço já está no carrinho.');
        return;
      }
    }

    setCarrinho([...carrinho, item]);
  };

  const removerDoCarrinho = (itemId: string, itemTipo: 'mensalidade' | 'servico') => {
    setCarrinho(prev => prev.filter(item => !(item.id === itemId && item.tipo === itemTipo)));
  };

  const total = useMemo(() => carrinho.reduce((acc, item) => acc + item.preco, 0), [carrinho]);
  const troco = Math.max(0, pagamento.valorRecebido - total);
  const prontoParaFechar = total > 0 && (pagamento.metodo !== 'cash' || pagamento.valorRecebido >= total);

  // --- Ações de Checkout ---

  const handleCheckout = async () => {
    if (!alunoSelecionado?.id) {
      toast.error('Nenhum aluno selecionado.');
      return;
    }
    if (carrinho.length === 0) {
      toast.error('Carrinho vazio.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        p_aluno_id: alunoSelecionado.id,
        p_escola_id: escolaId, // Passa o escolaId real
        p_carrinho_itens: carrinho.map(item => ({
          id: item.id,
          tipo: item.tipo,
          preco: item.preco,
          ...(item.tipo === 'mensalidade' ? { mes_referencia: (item as Mensalidade).mes_referencia, ano_referencia: (item as Mensalidade).ano_referencia } : {})
        })),
        p_metodo_pagamento: pagamento.metodo,
        p_valor_recebido: pagamento.valorRecebido,
      };

      const { data, error } = await supabase.rpc('realizar_pagamento_balcao', payload);

      if (error) {
        throw new Error(error.message);
      }
      
      const result = data as any;
      if (!result.ok) {
        throw new Error(result.erro || 'Falha no pagamento do balcão.');
      }

      toast.success(`Pagamento realizado! Troco: ${kwanza.format(result.troco)}`);
      // Resetar estado
      setCarrinho([]);
      setPagamento({ metodo: 'cash', valorRecebido: 0 });
      // Recarregar dados do aluno para atualizar pendências
      loadAlunoDossier(alunoSelecionado.id); 
    } catch (error: any) {
      console.error('Erro no checkout:', error);
      toast.error(error.message || 'Erro ao finalizar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* LADO ESQUERDO: Operação (70%) */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* 1. Barra de Busca Global (O Coração) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex gap-4 items-center">
          <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Buscar Aluno (Nome, Processo ou BI)</label>
            <input 
              type="text" 
              className="w-full text-xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
              placeholder="Digite para buscar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              // Lógica para exibir resultados da busca
            />
          </div>
          {isSearching && <Loader2 className="animate-spin text-slate-400" />}
        </div>

        {/* Resultados da Busca */}
        {searchTerm && alunosEncontrados.length > 0 && (
          <div className="absolute left-4 top-28 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-[calc(70%-32px)]">
            {alunosEncontrados.map(aluno => (
              <button 
                key={aluno.id}
                className="flex items-center gap-3 p-3 w-full text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                onClick={() => {
                  setAlunoSelecionado(aluno as AlunoDossier); // Seleciona o aluno da busca
                  setSearchTerm(''); // Limpa a busca
                  loadAlunoDossier(aluno.id); // Carrega dados completos
                }}
              >
                <img src={aluno.foto_url || 'https://i.pravatar.cc/150?u=0'} className="w-10 h-10 rounded-full object-cover" alt="Foto do Aluno" />
                <div>
                  <div className="font-bold text-slate-900">{aluno.nome}</div>
                  <div className="text-sm text-slate-500">{aluno.turma} | Proc: {aluno.numero_processo}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {searchTerm && alunosEncontrados.length === 0 && !isSearching && (
          <div className="absolute left-4 top-28 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-[calc(70%-32px)] p-3 text-sm text-slate-500">
            Nenhum aluno encontrado.
          </div>
        )}

        {/* 2. Área do Aluno Selecionado */}
        {alunoSelecionado && !alunoDossierLoading && (
          <div className="flex-1 grid grid-cols-12 gap-4">
            {/* Card do Aluno + Status */}
            <div className="col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-start gap-4 mb-6">
                <img src={alunoSelecionado.foto_url || 'https://i.pravatar.cc/150?u=0'} className="w-20 h-20 rounded-xl bg-slate-200 object-cover" alt="Foto do Aluno" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">{alunoSelecionado.nome}</h2>
                  <p className="text-sm text-slate-500 font-medium">{alunoSelecionado.turma}</p>
                  <span className="inline-block mt-2 px-2 py-1 bg-slate-100 text-xs font-mono rounded text-slate-600 border border-slate-200">
                    Proc: {alunoSelecionado.numero_processo}
                  </span>
                </div>
              </div>

              {/* Status Financeiro Crítico */}
              <div className={`p-4 rounded-xl border-l-4 mb-4 ${alunoSelecionado.status_financeiro === 'inadimplente' ? 'bg-rose-50 border-rose-500' : 'bg-emerald-50 border-emerald-500'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {alunoSelecionado.status_financeiro === 'inadimplente' ? <AlertCircle className="w-5 h-5 text-rose-600" /> : <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  <span className={`font-bold uppercase text-sm ${alunoSelecionado.status_financeiro === 'inadimplente' ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {alunoSelecionado.status_financeiro === 'inadimplente' ? 'Pendências Financeiras' : 'Situação Regular'}
                  </span>
                </div>
                {alunoSelecionado.status_financeiro === 'inadimplente' && (
                  <p className="text-2xl font-bold text-rose-800">{kwanza.format(alunoSelecionado.divida_total)}</p>
                )}
              </div>

              {/* Histórico Rápido (ainda mock) */}
              <div className="mt-auto">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Últimos Atendimentos</h4>
                <div className="text-xs text-slate-500 space-y-2">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Emissão Declaração</span>
                    <span className="text-slate-400">12/Jan</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Pagamento Jan/24</span>
                    <span className="text-slate-400">05/Jan</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Catálogo de Serviços (Grade de Ação) */}
            <div className="col-span-8 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm overflow-y-auto">
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar ao Atendimento
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Grupo: Pendências (Mensalidades Atrasadas) */}
                {mensalidadesDisponiveis.filter(m => m.atrasada).map(item => (
                  <button 
                    key={item.id}
                    onClick={() => adicionarAoCarrinho(item)}
                    className="flex items-center justify-between p-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors text-left group"
                  >
                    <div>
                      <div className="text-xs font-bold text-rose-600 uppercase mb-0.5">Em Atraso</div>
                      <div className="font-bold text-rose-900">{item.nome}</div>
                    </div>
                    <div className="text-rose-800 font-bold">{kwanza.format(item.preco)}</div>
                  </button>
                ))}

                {/* Grupo: Mensalidades Futuras/Atuais */}
                {mensalidadesDisponiveis.filter(m => !m.atrasada).map(item => (
                  <button 
                    key={item.id}
                    onClick={() => adicionarAoCarrinho(item)}
                    className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left group"
                  >
                    <div>
                      <div className="text-xs font-bold text-emerald-600 uppercase mb-0.5">Mensalidade</div>
                      <div className="font-bold text-emerald-900">{item.nome}</div>
                    </div>
                    <div className="text-emerald-800 font-bold">{kwanza.format(item.preco)}</div>
                  </button>
                ))}

                {/* Grupo: Serviços Comuns */}
                {servicosDisponiveis.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => adicionarAoCarrinho(item)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="font-medium text-slate-700">{item.nome}</div>
                    <div className="text-slate-900 font-bold">{kwanza.format(item.preco)}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {!alunoSelecionado && !alunoDossierLoading && !isSearching && (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-lg">
            Pesquise por um aluno para iniciar o atendimento.
          </div>
        )}
         {alunoDossierLoading && (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-lg">
            <Loader2 className="animate-spin mr-2" /> Carregando dossiê do aluno...
          </div>
        )}
      </div>

      {/* LADO DIREITO: Caixa / Checkout (30%) */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-10">
        {/* Header do Caixa */}
        <div className="p-6 bg-slate-900 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            Resumo
          </h2>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {carrinho.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
              <ShoppingCart className="w-12 h-12 mb-2" />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            carrinho.map((item) => (
              <div key={`${item.id}-${item.tipo}`} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="text-sm font-medium text-slate-800">{item.nome}</div>
                  <div className="text-xs text-slate-500 uppercase">{item.tipo === 'mensalidade' ? 'Mensalidade' : 'Serviço'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900">{kwanza.format(item.preco)}</span>
                  <button onClick={() => removerDoCarrinho(item.id, item.tipo)} className="text-rose-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Área de Pagamento (Fundo Fixo) */}
        <div className="bg-slate-50 p-6 border-t border-slate-200">
          {/* Subtotal */}
          <div className="flex justify-between items-end mb-6">
            <span className="text-sm font-bold text-slate-500 uppercase">Total a Pagar</span>
            <span className="text-3xl font-bold text-slate-900">{kwanza.format(total)}</span>
          </div>

          {/* Método de Pagamento */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button 
              onClick={() => setPagamento({ ...pagamento, metodo: 'cash' })}
              className={`p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${pagamento.metodo === 'cash' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-white border border-slate-200 text-slate-500'}`}
            >
              <Banknote className="w-4 h-4" /> Numerário
            </button>
            <button 
              onClick={() => setPagamento({ ...pagamento, metodo: 'tpa' })}
              className={`p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${pagamento.metodo === 'tpa' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-white border border-slate-200 text-slate-500'}`}
            >
              <CreditCard className="w-4 h-4" /> TPA / MB
            </button>
          </div>

          {/* Input de Dinheiro (Só aparece se for Cash) */}
          {pagamento.metodo === 'cash' && (
            <div className="mb-4 animate-in slide-in-from-bottom-2">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor Recebido (Kz)</label>
              <input 
                type="number" 
                className="w-full p-3 rounded-xl border border-slate-300 text-right font-mono text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="0"
                onChange={(e) => setPagamento({ ...pagamento, valorRecebido: Number(e.target.value) })}
                value={pagamento.valorRecebido === 0 ? '' : pagamento.valorRecebido}
              />
              {troco > 0 && (
                <div className="flex justify-between items-center mt-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  <span className="text-xs font-bold uppercase">Troco</span>
                  <span className="font-bold font-mono">{kwanza.format(troco)}</span>
                </div>
              )}
            </div>
          )}

          {/* Botão Final */}
          <button 
            disabled={!prontoParaFechar || isSubmitting}
            onClick={handleCheckout}
            className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all
              ${prontoParaFechar && !isSubmitting
                ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02]' 
                : 'bg-slate-300 cursor-not-allowed'}`}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
            ) : (
              <><Printer className="w-5 h-5" /> Confirmar e Imprimir</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}