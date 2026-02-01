// apps/web/src/components/secretaria/BalcaoAtendimento.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ShoppingCart,
  Printer,
  Trash2,
  CreditCard,
  Banknote,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  FileText,
  Plus,
  Loader2,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type MetodoPagamento = "dinheiro" | "tpa" | "transferencia" | "mbway";

// --- TIPOS ---
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
  status_financeiro: "em_dia" | "inadimplente";
  divida_total: number;
}

interface Mensalidade {
  id: string;
  nome: string;
  preco: number; // saldo a pagar
  tipo: "mensalidade";
  atrasada: boolean;
  mes_referencia: number;
  ano_referencia: number;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  tipo: "servico";
}

type ItemCarrinho = Mensalidade | Servico;

interface BalcaoAtendimentoProps {
  escolaId: string;
}

function formatMesAno(mes?: number, ano?: number) {
  if (!mes || mes < 1 || mes > 12 || !ano) return "Mensalidade";
  const label = new Date(0, mes - 1).toLocaleString("pt-PT", { month: "short" });
  return `Mensalidade ${label}/${ano}`;
}

function normalizeQuery(q: string) {
  return q.trim();
}

function makeIdempotencyKey() {
  // simples e bom: sessão + timestamp + random
  return `balcao_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function StatusPill({ status }: { status: "em_dia" | "inadimplente" }) {
  const bad = status === "inadimplente";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        bad
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      {bad ? "Inadimplente" : "Em dia"}
    </span>
  );
}

function SkeletonLine() {
  return <div className="h-3 w-full animate-pulse rounded-full bg-slate-200" />;
}

export default function BalcaoAtendimento({ escolaId }: BalcaoAtendimentoProps) {
  const supabase = createClient();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [alunosEncontrados, setAlunosEncontrados] = useState<AlunoBusca[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoDossier | null>(null);

  const [mensalidadesDisponiveis, setMensalidadesDisponiveis] = useState<Mensalidade[]>([]);
  const [servicosDisponiveis, setServicosDisponiveis] = useState<Servico[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const [metodo, setMetodo] = useState<MetodoPagamento>("dinheiro");
  const [valorRecebido, setValorRecebido] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [alunoDossierLoading, setAlunoDossierLoading] = useState(false);

  const idempotencyRef = useRef<string>(makeIdempotencyKey());
  const abortSearchRef = useRef<AbortController | null>(null);

  // --- Load serviços (catálogo) ---
  useEffect(() => {
    let mounted = true;
    async function loadServicos() {
      const { data, error } = await supabase
        .from("servicos_catalogo")
        .select("id, nome, preco, tipo")
        .eq("escola_id", escolaId)
        .eq("ativo", true);

      if (!mounted) return;

      if (error) {
        console.error(error);
        toast.error("Erro ao carregar serviços.");
        setServicosDisponiveis([]);
        return;
      }
      setServicosDisponiveis((data ?? []) as Servico[]);
    }
    loadServicos();
    return () => {
      mounted = false;
    };
  }, [supabase, escolaId]);

  // --- Load aluno dossier ---
  const loadAlunoDossier = useCallback(
    async (alunoId: string) => {
      setAlunoDossierLoading(true);
      try {
        const { data: dossier, error } = await supabase.rpc("get_aluno_dossier", {
          p_escola_id: escolaId,
          p_aluno_id: alunoId,
        });

        if (error || !dossier) {
          console.error(error);
          toast.error("Erro ao carregar dossiê do aluno.");
          setAlunoSelecionado(null);
          setMensalidadesDisponiveis([]);
          setCarrinho([]);
          return;
        }

        const raw = dossier as any;
        const financeiro = raw.financeiro || {};
        const perfil = raw.perfil || {};
        const historico = Array.isArray(raw.historico) ? raw.historico : [];

        const totalAtraso = Number(financeiro.total_em_atraso ?? 0);
        const status_financeiro: AlunoDossier["status_financeiro"] =
          totalAtraso > 0 ? "inadimplente" : "em_dia";

        // histórico: teu tipo usa `status` (não status_final)
        const atual =
          historico.find((h: any) => ["ativo", "ativa"].includes(String(h?.status ?? "").toLowerCase())) ??
          historico[0] ??
          null;

        const aluno: AlunoDossier = {
          id: alunoId,
          nome: perfil.nome_completo || perfil.nome || "Aluno",
          numero_processo: perfil.numero_processo || "—",
          bi_numero: perfil.bi_numero || null,
          turma: atual?.turma || "—",
          status_financeiro,
          divida_total: totalAtraso,
          foto_url: perfil.foto_url || null,
          matricula_id: atual?.matricula_id || null,
        };

        // mensalidades: alinhar campos (m.mes, m.ano, m.valor, m.pago)
        const mensalidades: Mensalidade[] = (financeiro.mensalidades || [])
          .filter((m: any) => ["pendente", "pago_parcial"].includes(String(m.status)))
          .map((m: any) => {
            const mes = Number(m.mes ?? m.mes_referencia);
            const ano = Number(m.ano ?? m.ano_referencia);
            const valor = Number(m.valor ?? 0);
            const pago = Number(m.pago ?? m.valor_pago_total ?? 0);
            const saldo = Math.max(0, valor - pago);

            const venc = m.vencimento || m.data_vencimento || null;
            const atrasada = venc ? new Date(venc) < new Date() : false;

            return {
              id: String(m.id),
              nome: formatMesAno(mes, ano),
              preco: saldo,
              tipo: "mensalidade",
              atrasada,
              mes_referencia: mes,
              ano_referencia: ano,
            };
          })
          .filter((m) => m.preco > 0);

        setAlunoSelecionado(aluno);
        setMensalidadesDisponiveis(mensalidades);
        setCarrinho([]);
        setMetodo("dinheiro");
        setValorRecebido("");
        idempotencyRef.current = makeIdempotencyKey();
      } finally {
        setAlunoDossierLoading(false);
      }
    },
    [supabase, escolaId]
  );

  // --- Search alunos (debounced) ---
  useEffect(() => {
    const q = normalizeQuery(debouncedSearchTerm);
    if (!q) {
      setAlunosEncontrados([]);
      setIsSearching(false);
      abortSearchRef.current?.abort();
      abortSearchRef.current = null;
      return;
    }

    setIsSearching(true);
    abortSearchRef.current?.abort();
    abortSearchRef.current = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `/api/secretaria/balcao/alunos/search?query=${encodeURIComponent(q)}`,
          { signal: abortSearchRef.current?.signal }
        );
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.ok) {
          setAlunosEncontrados([]);
          return;
        }
        setAlunosEncontrados(Array.isArray(json.alunos) ? json.alunos : []);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error(e);
        setAlunosEncontrados([]);
      } finally {
        setIsSearching(false);
      }
    })();

    return () => {};
  }, [debouncedSearchTerm]);

  // --- Carrinho ---
  const adicionarAoCarrinho = (item: ItemCarrinho) => {
    if (item.tipo === "mensalidade") {
      const m = item as Mensalidade;
      const exists = carrinho.some(
        (c) =>
          c.tipo === "mensalidade" &&
          (c as Mensalidade).mes_referencia === m.mes_referencia &&
          (c as Mensalidade).ano_referencia === m.ano_referencia
      );
      if (exists) return toast.message("Mensalidade já está no carrinho.");
    }

    if (item.tipo === "servico") {
      const exists = carrinho.some((c) => c.tipo === "servico" && c.id === item.id);
      if (exists) return toast.message("Serviço já está no carrinho.");
    }

    setCarrinho((prev) => [...prev, item]);
  };

  const removerDoCarrinho = (itemId: string, itemTipo: ItemCarrinho["tipo"]) => {
    setCarrinho((prev) => prev.filter((i) => !(i.id === itemId && i.tipo === itemTipo)));
  };

  const limparCarrinho = () => {
    setCarrinho([]);
    setValorRecebido("");
    idempotencyRef.current = makeIdempotencyKey();
  };

  const total = useMemo(
    () => carrinho.reduce((acc, item) => acc + Number(item.preco || 0), 0),
    [carrinho]
  );

  const valorRecebidoNum = useMemo(() => {
    const n = Number(valorRecebido);
    return Number.isFinite(n) ? n : 0;
  }, [valorRecebido]);

  const troco = useMemo(() => Math.max(0, valorRecebidoNum - total), [valorRecebidoNum, total]);

  const prontoParaFechar =
    total > 0 && (metodo !== "dinheiro" || (valorRecebidoNum > 0 && valorRecebidoNum >= total));

  // --- Checkout ---
  const handleCheckout = async () => {
    if (!alunoSelecionado?.id) return toast.error("Nenhum aluno selecionado.");
    if (carrinho.length === 0) return toast.error("Carrinho vazio.");

    if (metodo === "dinheiro" && valorRecebidoNum < total) {
      return toast.error("Valor recebido insuficiente.");
    }

    setIsSubmitting(true);
    try {
      const payload = {
        p_aluno_id: alunoSelecionado.id,
        p_escola_id: escolaId,
        p_idempotency_key: idempotencyRef.current,
        p_carrinho_itens: carrinho.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          preco: item.preco,
          ...(item.tipo === "mensalidade"
            ? {
                mes_referencia: (item as Mensalidade).mes_referencia,
                ano_referencia: (item as Mensalidade).ano_referencia,
              }
            : {}),
        })),
        p_metodo_pagamento: metodo,
        p_valor_recebido: metodo === "dinheiro" ? valorRecebidoNum : total,
      };

      const { data, error } = await supabase.rpc("realizar_pagamento_balcao", payload as any);
      if (error) throw new Error(error.message);

      const result = data as any;
      if (!result?.ok) throw new Error(result?.erro || "Falha ao finalizar pagamento.");

      toast.success(`Pagamento registrado. Troco: ${kwanza.format(Number(result.troco ?? 0))}`);

      limparCarrinho();
      await loadAlunoDossier(alunoSelecionado.id);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao finalizar pagamento.");
      // IMPORTANT: não regenere idempotency key aqui, senão pode duplicar tentativa
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendenciasAtrasadas = useMemo(
    () => mensalidadesDisponiveis.filter((m) => m.atrasada),
    [mensalidadesDisponiveis]
  );
  const pendenciasEmDia = useMemo(
    () => mensalidadesDisponiveis.filter((m) => !m.atrasada),
    [mensalidadesDisponiveis]
  );

  // --- UI ---
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-8 space-y-6">
            {/* Search */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Search className="h-5 w-5 text-slate-500" />
                  </div>

                  <div className="flex-1">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      Buscar aluno (Nome / BI / Processo / Telefone)
                    </div>
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Digite para buscar…"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    />
                  </div>

                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setAlunosEncontrados([]);
                      }}
                      className="rounded-xl p-2 hover:bg-slate-100 transition focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                      aria-label="Limpar busca"
                    >
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Results */}
              {normalizeQuery(searchTerm) ? (
                <div className="border-t border-slate-200">
                  {alunosEncontrados.length === 0 && !isSearching ? (
                    <div className="p-4 text-sm text-slate-500">Nenhum aluno encontrado.</div>
                  ) : (
                    <div className="max-h-72 overflow-auto">
                      {alunosEncontrados.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setSearchTerm("");
                            setAlunosEncontrados([]);
                            loadAlunoDossier(a.id);
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0"
                        >
                          <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                            {a.foto_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.foto_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">AL</span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900 truncate">{a.nome}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {a.turma} • Proc {a.numero_processo} • {a.bi_numero || "BI —"}
                            </div>
                          </div>

                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Aluno + Catálogo */}
            {alunoDossierLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  <div className="text-sm font-semibold text-slate-700">Carregando dossiê do aluno…</div>
                </div>
                <div className="space-y-3">
                  <SkeletonLine />
                  <SkeletonLine />
                  <SkeletonLine />
                </div>
              </div>
            ) : alunoSelecionado ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Card aluno */}
                <div className="xl:col-span-4 rounded-xl border border-slate-200 bg-white shadow-sm p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                      {alunoSelecionado.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={alunoSelecionado.foto_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-slate-500">ALUNO</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-slate-900 truncate">
                          {alunoSelecionado.nome}
                        </h2>
                        <StatusPill status={alunoSelecionado.status_financeiro} />
                      </div>

                      <div className="mt-2 text-sm text-slate-600 font-medium truncate">
                        {alunoSelecionado.turma}
                      </div>

                      <div className="mt-3 inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700">
                        Proc {alunoSelecionado.numero_processo}
                      </div>

                      {alunoSelecionado.status_financeiro === "inadimplente" ? (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                            <AlertCircle className="h-5 w-5" />
                            Dívida total
                          </div>
                          <div className="mt-1 text-2xl font-black text-red-800">
                            {kwanza.format(alunoSelecionado.divida_total)}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                            <CheckCircle className="h-5 w-5" />
                            Situação regular
                          </div>
                          <div className="mt-1 text-sm text-emerald-700">
                            Sem pendências críticas no momento.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                      Últimos atendimentos
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span>Emissão declaração</span>
                        <span className="text-slate-500">—</span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span>Pagamento</span>
                        <span className="text-slate-500">—</span>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        (Quando você ligar isso no Audit Trail, aqui vira ouro.)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catálogo */}
                <div className="xl:col-span-8 rounded-xl border border-slate-200 bg-white shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-slate-500" />
                      <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Adicionar ao atendimento
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      Clique para adicionar no carrinho
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Pendências em atraso */}
                    {pendenciasAtrasadas.length > 0 ? (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-red-700 mb-2">
                          Pendências em atraso
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {pendenciasAtrasadas.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => adicionarAoCarrinho(m)}
                              className="rounded-xl border border-red-200 bg-red-50 p-4 text-left hover:bg-red-100 transition"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-red-900 truncate">
                                    {m.nome}
                                  </div>
                                  <div className="text-xs text-red-700">Atrasada</div>
                                </div>
                                <div className="text-sm font-black text-red-900">
                                  {kwanza.format(m.preco)}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Mensalidades */}
                    {pendenciasEmDia.length > 0 ? (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                          Mensalidades pendentes
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {pendenciasEmDia.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => adicionarAoCarrinho(m)}
                              className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 transition"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 truncate">
                                    {m.nome}
                                  </div>
                                  <div className="text-xs text-slate-500">Mensalidade</div>
                                </div>
                                <div className="text-sm font-black text-slate-900">
                                  {kwanza.format(m.preco)}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Serviços */}
                    <div>
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                        Serviços
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {servicosDisponiveis.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => adicionarAoCarrinho(s)}
                            className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 transition"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {s.nome}
                                </div>
                                <div className="text-xs text-slate-500">Serviço</div>
                              </div>
                              <div className="text-sm font-black text-slate-900">
                                {kwanza.format(s.preco)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {pendenciasAtrasadas.length === 0 &&
                    pendenciasEmDia.length === 0 &&
                    servicosDisponiveis.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                        Nada disponível para cobrança no momento.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm text-center text-slate-500">
                Pesquise um aluno para iniciar o atendimento.
              </div>
            )}
          </div>

          {/* RIGHT (Resumo / Caixa) */}
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-950 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-klasse-gold" />
                    <div className="text-base font-semibold text-white">Resumo do Caixa</div>
                  </div>

                  {carrinho.length > 0 ? (
                    <button
                      type="button"
                      onClick={limparCarrinho}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpar
                    </button>
                  ) : null}
                </div>

                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-white/70">
                    Total a pagar
                  </div>
                  <div className="mt-1 text-3xl font-black text-white">
                    {kwanza.format(total)}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="p-6 space-y-3">
                {carrinho.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Carrinho vazio.
                  </div>
                ) : (
                  carrinho.map((item) => (
                    <div
                      key={`${item.id}-${item.tipo}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {item.nome}
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                            {item.tipo === "mensalidade" ? "Mensalidade" : "Serviço"}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900">
                            {kwanza.format(item.preco)}
                          </div>
                          <button
                            type="button"
                            onClick={() => removerDoCarrinho(item.id, item.tipo)}
                            className="mt-2 inline-flex items-center gap-2 rounded-xl px-2 py-1 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Pagamento */}
                <div className="pt-2">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                    Método de pagamento
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMetodo("dinheiro")}
                      className={cx(
                        "rounded-xl border px-3 py-3 text-left transition",
                        metodo === "dinheiro"
                          ? "border-klasse-gold bg-klasse-gold/10"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-slate-600" />
                        <div className="text-sm font-semibold text-slate-900">Dinheiro</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMetodo("tpa")}
                      className={cx(
                        "rounded-xl border px-3 py-3 text-left transition",
                        metodo === "tpa"
                          ? "border-klasse-gold bg-klasse-gold/10"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-slate-600" />
                        <div className="text-sm font-semibold text-slate-900">TPA</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMetodo("transferencia")}
                      className={cx(
                        "rounded-xl border px-3 py-3 text-left transition",
                        metodo === "transferencia"
                          ? "border-klasse-gold bg-klasse-gold/10"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-slate-600" />
                        <div className="text-sm font-semibold text-slate-900">Transferência</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMetodo("mbway")}
                      className={cx(
                        "rounded-xl border px-3 py-3 text-left transition",
                        metodo === "mbway"
                          ? "border-klasse-gold bg-klasse-gold/10"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-slate-600" />
                        <div className="text-sm font-semibold text-slate-900">MBWay</div>
                      </div>
                    </button>
                  </div>

                  {metodo === "dinheiro" ? (
                    <div className="mt-4">
                      <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                        Valor recebido (Kz)
                      </label>
                      <div className="mt-2 relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={valorRecebido}
                          onChange={(e) => setValorRecebido(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                          Kz
                        </div>
                      </div>

                      {valorRecebidoNum > 0 ? (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-emerald-800">Troco</div>
                            <div className="text-xl font-black text-emerald-800">
                              {kwanza.format(troco)}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <button
                      type="button"
                      disabled={!prontoParaFechar || isSubmitting}
                      onClick={handleCheckout}
                      className={cx(
                        "w-full rounded-xl px-4 py-4 text-sm font-semibold inline-flex items-center justify-center gap-2 transition",
                        prontoParaFechar && !isSubmitting
                          ? "bg-klasse-gold text-white hover:brightness-95"
                          : "bg-slate-200 text-slate-500 cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processando…
                        </>
                      ) : (
                        <>
                          <Printer className="h-5 w-5" />
                          Confirmar e imprimir
                        </>
                      )}
                    </button>

                    <div className="mt-3 text-xs text-slate-500">
                      Ação crítica. Deve gerar recibo + audit trail.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* hint */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              Dica: quando você ligar o **Fecho de Caixa Cego**, esse painel vira “Caixa do Dia” com saldo + diferenças.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
