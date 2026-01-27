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

export function BuscaBalcaoRapido() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<AlunoResult[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoResult | null>(null);
  const [mensalidadeAtual, setMensalidadeAtual] = useState<MensalidadeResumo | null>(null);
  const [mensalidades, setMensalidades] = useState<MensalidadeResumo[]>([]);
  const [totalEmAtraso, setTotalEmAtraso] = useState<number>(0);
  const debouncedQuery = useDebounce(query.trim(), 300);

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
    router.push(`/secretaria/alunos/${alunoId}`);
    setMostrarResultados(false);
    setQuery("");
  };

  const buscarMensalidades = async (aluno: AlunoResult) => {
    try {
      const res = await fetch(`/api/financeiro/extrato/aluno/${encodeURIComponent(aluno.id)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      
      if (!data.ok) {
        // Erro específico - mostrar mensagem útil
        if (data.error?.includes("não pertence à sua escola")) {
          toast({
            title: "Aluno não encontrado",
            description: "Este aluno pertence a outra escola. Contacte o administrador.",
            variant: "destructive",
          });
        } else if (data.error?.includes("Escola não identificada")) {
          toast({
            title: "Problema de configuração",
            description: "Sua conta não está associada a uma escola. Contacte o administrador.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao buscar dados financeiros",
            description: data.error || "Tente novamente ou contacte o suporte.",
            variant: "destructive",
          });
        }
        
        setMensalidades([]);
        return;
      }
      
      // Sucesso - processar dados
      setMensalidades(data.mensalidades || []);
      setTotalEmAtraso(data.total_em_atraso || 0);

      const parcelas = (data.mensalidades || []) as Array<{
        id: string;
        mes: number;
        ano: number;
        valor: number;
        status: string;
        vencimento?: string | null;
      }>;
      
      const pendentes = parcelas.filter(
        (m) => m.status === "pendente" || m.status === "pago_parcial"
      );
      const mensalidade = pendentes[0] ?? parcelas[0] ?? null;
      if (!mensalidade) {
        toast.error("Não há mensalidades pendentes para este aluno.");
        return;
      }
      setAlunoSelecionado(aluno);
      setMensalidadeAtual(mensalidade);
      setModalAberto(true);
      
    } catch (error) {
      console.error("Erro na requisição:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor. Verifique sua internet.",
        variant: "destructive",
      });
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
              role="button"
              tabIndex={0}
              className="w-full p-3 hover:bg-gray-50 text-left border-b last:border-b-0 flex items-center gap-3"
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
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  buscarMensalidades({
                    ...aluno,
                    id: aluno.aluno_id ?? aluno.id,
                  });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
              >
                <CreditCard className="h-4 w-4" />
                Pagar
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

      {alunoSelecionado && (
        <ModalPagamentoRapido
          aluno={{
            id: alunoSelecionado.id,
            nome: alunoSelecionado.nome || "Aluno",
            turma: alunoSelecionado.turma_atual ?? undefined,
            bi: alunoSelecionado.bi_numero ?? undefined,
          }}
          mensalidade={mensalidadeAtual}
          open={modalAberto}
          onClose={() => {
            setModalAberto(false);
            setAlunoSelecionado(null);
            setMensalidadeAtual(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
