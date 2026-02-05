"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, User, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { ModalPagamentoRapido } from "@/components/secretaria/ModalPagamentoRapido";
import { toast } from "sonner";

type AlunoResult = {
  id: string;
  aluno_id?: string | null;
  nome?: string | null;
  bi_numero?: string | null;
  telefone_responsavel?: string | null;
  numero_processo?: string | null;
  turma_atual?: string | null;
  total_em_atraso?: number | null;
};

type MensalidadeResumo = {
  id: string;
  mes: number;
  ano: number;
  valor: number;
  status: string;
  vencimento?: string | null;
};

export function BuscaBalcaoRapido({ escolaId }: { escolaId: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<AlunoResult[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [modalAberto, setModalAberto] = useState(false); // Old state, still used for other modal.
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoResult | null>(null); // Old state, still used for other modal.
  const [mensalidadeAtual, setMensalidadeAtual] = useState<MensalidadeResumo | null>(null); // Old state, still used for other modal.
  const [mensalidades, setMensalidades] = useState<MensalidadeResumo[]>([]);
  const [totalEmAtraso, setTotalEmAtraso] = useState<number>(0);
  const debouncedQuery = useDebounce(query.trim(), 300);

  // Novos estados para o modal de pagamento rápido
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [alunoParaPagamento, setAlunoParaPagamento] = useState<{
    id: string;
    nome: string;
    bi?: string;
    turma?: string;
  } | null>(null);
  const [mensalidadeParaPagamento, setMensalidadeParaPagamento] = useState<{
    id: string;
    mes: number;
    ano: number;
    valor: number;
    vencimento?: string;
    status: string;
  } | null>(null);
  const [carregandoPagamento, setCarregandoPagamento] = useState(false);


  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        if (active) {
          setResultados([]);
          setCarregando(false);
        }
        return;
      }

      setCarregando(true);
      try {
        const params = new URLSearchParams({
          search: debouncedQuery,
          limit: "5",
          status: "ativo",
          includeResumo: "1",
        });
        const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        const rows = (data.items || data.data || []) as AlunoResult[];
        if (active) setResultados(rows);
      } catch (error) {
        if (active) setResultados([]);
        console.error("Erro na busca:", error);
      } finally {
        if (active) setCarregando(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const results = useMemo(() => resultados.slice(0, 5), [resultados]);

  const selecionarAluno = (alunoId: string) => {
    if (!escolaId) {
      toast.error("Não foi possível identificar a escola para navegar.");
      return;
    }
    router.push(`/escola/${escolaId}/secretaria/alunos/${alunoId}`);
    setMostrarResultados(false);
    setQuery("");
  };

  const handlePagarClick = async (alunoId: string) => {
    console.log('🎯 Iniciando pagamento rápido para aluno:', alunoId);
    setCarregandoPagamento(true);
    
    try {
      // 1. Buscar dados específicos para pagamento rápido
      const response = await fetch(`/api/alunos/${alunoId}/pagamento-rapido`);
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Erro ao buscar dados do aluno');
      }
      
      if (!data.mensalidade) {
        toast.info('Este aluno não possui mensalidades pendentes.');
        return;
      }
      
      console.log('📦 Dados recebidos:', data);
      
      // 2. Preparar dados para o modal
      setAlunoParaPagamento({
        id: data.aluno.id,
        nome: data.aluno.nome,
        bi: data.aluno.bi,
        turma: data.aluno.turma
      });
      
      // 3. Mapear os nomes das colunas (ano_referencia → ano, mes_referencia → mes)
      setMensalidadeParaPagamento({
        id: data.mensalidade.id,
        mes: data.mensalidade.mes, // Já vem mapeado da API
        ano: data.mensalidade.ano, // Já vem mapeado da API
        valor: data.mensalidade.valor,
        vencimento: data.mensalidade.vencimento,
        status: data.mensalidade.status
      });
      
      // 4. Abrir o modal
      setModalPagamentoAberto(true);
      toast.success('Pronto para registrar pagamento');
      
    } catch (error) {
      console.error('❌ Erro ao preparar pagamento:', error);
      toast.error(
        error instanceof Error ? error.message : 'Erro ao processar pagamento'
      );
    } finally {
      setCarregandoPagamento(false);
    }
  };


  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          placeholder="Digite BI, nome ou telefone para buscar aluno..."
          className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMostrarResultados(true);
          }}
          onFocus={() => setMostrarResultados(true)}
        />
        {carregando && (
          <Loader2 className="absolute right-3 top-3 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {mostrarResultados && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((aluno) => (
            <div
              key={aluno.id}
              className="w-full p-3 text-left border-b last:border-b-0 flex items-center gap-3"
            >
              <div
                role="button"
                tabIndex={0}
                className="flex-1 flex items-center gap-3 cursor-pointer"
                onClick={() => selecionarAluno(aluno.aluno_id ?? aluno.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") selecionarAluno(aluno.aluno_id ?? aluno.id);
                }}
              >
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{aluno.nome || "Aluno"}</div>
                  <div className="text-xs text-gray-600">
                    BI: {aluno.bi_numero || "N/A"} • Tel: {aluno.telefone_responsavel || "N/A"}
                    {aluno.turma_atual ? ` • Turma: ${aluno.turma_atual}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-400">
                    {aluno.numero_processo ? <span>Processo: {aluno.numero_processo}</span> : null}
                    {Number(aluno.total_em_atraso ?? 0) > 0 ? (
                      <span className="text-red-600 font-medium">
                        Dívida: {Number(aluno.total_em_atraso ?? 0).toLocaleString("pt-AO")} AOA
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handlePagarClick(aluno.aluno_id ?? aluno.id);
                }}
                disabled={carregandoPagamento}
                className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
              >
                {carregandoPagamento ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pagar
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {mostrarResultados && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMostrarResultados(false)}
        />
      )}

      {/* Modal de Pagamento Rápido (novo) */}
      {modalPagamentoAberto && alunoParaPagamento && (
        <ModalPagamentoRapido
          escolaId={escolaId}
          aluno={alunoParaPagamento}
          mensalidade={mensalidadeParaPagamento}
          open={modalPagamentoAberto}
          onClose={() => {
            setModalPagamentoAberto(false);
            setAlunoParaPagamento(null);
            setMensalidadeParaPagamento(null);
            router.refresh(); // Refresh after payment
          }}
          onSuccess={() => {
            toast.success('Pagamento registrado com sucesso!');
            router.refresh(); // Refresh after payment
          }}
        />
      )}
    </div>
  );
}
