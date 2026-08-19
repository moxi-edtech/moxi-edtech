"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Printer,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRightLeft,
  Info,
  User,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useToast } from "@/components/feedback/FeedbackSystem";
import { useDebounce } from "@/hooks/useDebounce";
import { createClient } from "@/lib/supabaseClient";
import { useRematriculaBalcao } from "@/hooks/useRematriculaBalcao";
import { RematriculaBalcaoModal } from "@/components/secretaria/RematriculaBalcaoModal";
import { EnrollmentPostActionModal } from "@/components/secretaria/EnrollmentPostActionModal";
import type { EnrollmentPostAction } from "@/components/secretaria/EnrollmentPostActions";
import { PagamentoDividaModal } from "@/components/secretaria/PagamentoDividaModal";
import Link from "next/link";

const ACADEMIC_YEAR_PARAM = "ano_letivo_id";

export interface BalcaoAtendimentoProps {
  escolaId: string;
  selectedAlunoId?: string | null;
  showSearch?: boolean;
  embedded?: boolean;
  returnTo?: string | null;
}

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

export interface AlunoDossier {
  id: string;
  nome: string;
  foto_url?: string | null;
  numero_processo: string;
  turma_codigo?: string | null;
  curso_codigo?: string | null;
  classe?: string | null;
  status_financeiro: "em_dia" | "inadimplente" | "sem_matricula";
  divida_total: number;
  matricula_id?: string | null;
}

export interface Mensalidade {
  id: string;
  nome: string;
  preco: number;
  atrasada: boolean;
  referencia_mes?: number;
  referencia_ano?: number;
  origem_ano?: string | null;
  origem_matricula_id?: string | null;
  turma_id?: string | null;
  origem_turma?: string | null;
  tipo: "mensalidade";
}

export interface Servico {
  id: string;
  codigo: string;
  nome: string;
  preco: number;
  tipo: "servico";
  descricao?: string | null;
  documento_tipo?: string;
}

export type ItemCarrinho = Mensalidade | Servico;

export type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

export interface BillingWindowIssue {
  turmaId: string;
  turmaLabel: string;
  anoLetivoId: string;
  anoLetivoLabel: string;
  dataInicio: string;
  dataFim: string;
  competencia: string;
}

const METODOS_UI: { id: MetodoPagamento; icon: React.ElementType; label: string }[] = [
  { id: "cash", icon: Banknote, label: "Numerario" },
  { id: "tpa", icon: CreditCard, label: "TPA" },
  { id: "transfer", icon: ArrowRightLeft, label: "Transf." },
  { id: "mcx", icon: QrCode, label: "Multicaixa" },
  { id: "kiwk", icon: QrCode, label: "Kwik" },
];

function isDocServico(s: Servico): boolean {
  const text = `${s.codigo} ${s.nome} ${s.descricao ?? ""} ${s.documento_tipo ?? ""}`.toLowerCase();
  return ["doc", "declara", "documento", "certificado", "cartao", "cartão", "ficha"].some((term) => text.includes(term));
}

function isServicoRematricula(s: Servico): boolean {
  return s.codigo.trim().toUpperCase() === "SERV_REMATRICULA";
}

function getDocTipo(s: Servico): string {
  if (s.documento_tipo) return s.documento_tipo;
  return s.codigo.replace("DOC_", "").toLowerCase();
}

function getUnlockedMensalidadeIds(mensalidades: Mensalidade[], selectedIds: string[]): Set<string> {
  const sorted = [...mensalidades].sort((a, b) => {
    const competenciaA = (a.referencia_ano ?? 0) * 100 + (a.referencia_mes ?? 0);
    const competenciaB = (b.referencia_ano ?? 0) * 100 + (b.referencia_mes ?? 0);
    return competenciaA - competenciaB;
  });

  const unlocked = new Set<string>();
  const selectedSet = new Set(selectedIds);

  for (const m of sorted) {
    unlocked.add(m.id);
    if (!selectedSet.has(m.id)) {
      break;
    }
  }

  return unlocked;
}

function useAlunoSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [alunosEncontrados, setAlunosEncontrados] = useState<AlunoDossier[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedTerm = useDebounce(searchTerm, 400);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = debouncedTerm.trim();
    if (!query) {
      setAlunosEncontrados([]);
      setIsSearching(false);
      abortRef.current?.abort();
      return;
    }

    setIsSearching(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/secretaria/balcao/alunos/search?query=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => response.json().catch(() => ({})))
      .then((json) => {
        if (!controller.signal.aborted) {
          setAlunosEncontrados(json?.ok && Array.isArray(json.alunos) ? json.alunos : []);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setAlunosEncontrados([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSearching(false);
      });

    return () => controller.abort();
  }, [debouncedTerm]);

  const clear = useCallback(() => {
    setSearchTerm("");
    setAlunosEncontrados([]);
  }, []);

  return { searchTerm, setSearchTerm, alunosEncontrados, isSearching, clear };
}

function useAlunoDossier(escolaId: string, academicYearId: string | null) {
  const [aluno, setAluno] = useState<AlunoDossier | null>(null);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (alunoId: string) => {
      setLoading(true);
      try {
        const supabase = createClient();
        let dossierRpc = "get_aluno_dossier";
        let dossierArgs: Record<string, unknown> = {
          p_escola_id: escolaId,
          p_aluno_id: alunoId,
        };

        // The contextual RPC expects the numeric academic year, while the UI
        // carries the academic-year UUID in `ano_letivo_id`.
        if (academicYearId) {
          const { data: year } = await supabase
            .from("anos_letivos")
            .select("ano")
            .eq("escola_id", escolaId)
            .eq("id", academicYearId)
            .maybeSingle();
          const numericYear = Number(year?.ano);
          if (Number.isInteger(numericYear)) {
            dossierRpc = "get_aluno_dossier_contextual";
            dossierArgs = { ...dossierArgs, p_ano_letivo: numericYear };
          }
        }

        const { data, error } = await (supabase as any).rpc(dossierRpc, dossierArgs);

        if (error) throw error;

        const raw = (data ?? {}) as any;
        const perfil = raw.perfil ?? raw.aluno ?? {};
        const financeiro = raw.financeiro ?? {};
        const historico = Array.isArray(raw.historico) ? raw.historico : [];
        const atual = raw.matricula_ativa ?? historico[0] ?? {};
        const divida = Number(financeiro.total_em_atraso ?? raw.aluno?.divida_total ?? 0);

        setAluno({
          id: String(raw.aluno?.id ?? alunoId),
          nome: String(perfil.nome_completo ?? perfil.nome ?? raw.aluno?.nome ?? "Aluno"),
          foto_url: perfil.foto_url ? String(perfil.foto_url) : null,
          numero_processo: String(perfil.numero_processo ?? raw.aluno?.numero_processo ?? "-"),
          turma_codigo: atual.turma_codigo ? String(atual.turma_codigo) : null,
          curso_codigo: atual.curso_codigo ? String(atual.curso_codigo) : null,
          classe: atual.classe ? String(atual.classe) : null,
          status_financeiro: divida > 0 ? "inadimplente" : "em_dia",
          divida_total: divida,
          // The dossier RPC returns the active registration as `{ id }`;
          // older payloads used `{ matricula_id }`. The rematricula status
          // endpoint needs the registration UUID in either case.
          matricula_id: atual.matricula_id
            ? String(atual.matricula_id)
            : atual.id
              ? String(atual.id)
              : null,
        });

        const rawMensalidades = (financeiro.mensalidades ?? raw.mensalidades ?? []) as Array<Record<string, unknown>>;
        const mensalidadeIds = rawMensalidades
          .map((m) => (m.id ? String(m.id) : ""))
          .filter(Boolean);
        const { data: origins } = mensalidadeIds.length > 0
          ? await supabase
              .from("mensalidades")
              .select("id, matricula_id, turma_id, ano_letivo")
              .eq("escola_id", escolaId)
              .eq("aluno_id", alunoId)
              .in("id", mensalidadeIds)
          : { data: [] };
        const originById = new Map((origins ?? []).map((origin) => [String(origin.id), origin]));
        const turmaIds = (origins ?? [])
          .map((origin) => origin.turma_id)
          .filter((id): id is string => Boolean(id));
        const { data: originTurmas } = turmaIds.length > 0
          ? await supabase.from("turmas").select("id, nome, turma_codigo").in("id", turmaIds)
          : { data: [] };
        const turmaById = new Map((originTurmas ?? []).map((turma) => [String(turma.id), turma]));

        const ms: Mensalidade[] = rawMensalidades
          .filter((m: any) => !m.status || ["pendente", "pago_parcial"].includes(String(m.status)))
          .map((m: any) => {
            const mes = Number(m.mes ?? m.mes_referencia ?? 0);
            const ano = Number(m.ano ?? m.ano_referencia ?? 0);
            const valor = Number(m.valor ?? m.preco ?? 0);
            const pago = Number(m.pago ?? m.valor_pago_total ?? 0);
            const vencimento = m.vencimento ?? m.data_vencimento;
            const origin = originById.get(String(m.id));
            const turma = origin?.turma_id ? turmaById.get(String(origin.turma_id)) : null;
            return {
              id: String(m.id),
              nome: mes && ano ? `Mensalidade ${new Date(0, mes - 1).toLocaleString("pt-PT", { month: "short" })}/${ano}` : String(m.nome ?? "Mensalidade"),
              preco: Math.max(0, valor - pago),
              atrasada: vencimento ? new Date(vencimento) < new Date() : Boolean(m.atrasada),
              referencia_mes: mes || undefined,
              referencia_ano: ano || undefined,
              origem_ano: origin?.ano_letivo ? String(origin.ano_letivo) : null,
              origem_matricula_id: origin?.matricula_id ? String(origin.matricula_id) : null,
              turma_id: origin?.turma_id ? String(origin.turma_id) : null,
              origem_turma: turma ? String(turma.turma_codigo ?? turma.nome ?? "Turma") : null,
              tipo: "mensalidade" as const,
            };
          })
          .filter((m: Mensalidade) => m.preco > 0)
          .sort((a, b) => {
            const aKey = Number(a.referencia_ano ?? 0) * 100 + Number(a.referencia_mes ?? 0);
            const bKey = Number(b.referencia_ano ?? 0) * 100 + Number(b.referencia_mes ?? 0);
            return aKey - bKey;
          });
        setMensalidades(ms);
      } catch {
        setAluno(null);
        setMensalidades([]);
      } finally {
        setLoading(false);
      }
    },
    [escolaId, academicYearId]
  );

  const clear = useCallback(() => {
    setAluno(null);
    setMensalidades([]);
  }, []);

  return { aluno, mensalidades, loading, load, clear };
}

function useServicos(escolaId: string) {
  const { error } = useToast();
  const [servicos, setServicos] = useState<Servico[]>([]);

  useEffect(() => {
    let alive = true;

    async function fetchServicos() {
      try {
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from("servicos_escola")
          .select("id, codigo, nome, descricao, valor_base")
          .eq("escola_id", escolaId)
          .eq("ativo", true);

        if (!alive) return;
        if (queryError) {
          error("Erro ao carregar serviços.");
          setServicos([]);
          return;
        }

        setServicos((data ?? []).map((service) => ({
          id: service.id,
          codigo: service.codigo,
          nome: service.nome,
          descricao: service.descricao,
          preco: Number(service.valor_base ?? 0),
          tipo: "servico" as const,
        })));
      } catch {
        if (alive) {
          setServicos([]);
          error("Erro ao carregar serviços.");
        }
      }
    }
    if (escolaId) void fetchServicos();

    return () => {
      alive = false;
    };
    // `useToast` creates action functions per render; including `error` here
    // would refetch the catalogue after every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolaId]);

  return servicos;
}

function useCarrinho() {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [metodo, setMetodoState] = useState<MetodoPagamento>("tpa");
  const [detalhes, setDetalhesState] = useState({ referencia: "", evidencia_url: "", gateway_ref: "" });
  const [valorRecebido, setValorRecebido] = useState("");

  const setDetalhes = useCallback((patch: Partial<typeof detalhes>) => {
    setDetalhesState((prev) => ({ ...prev, ...patch }));
  }, []);

  const adicionar = useCallback((item: ItemCarrinho) => {
    setItens((prev) => {
      if (prev.some((i) => i.id === item.id && i.tipo === item.tipo)) return prev;
      return [...prev, item];
    });
  }, []);

  const remover = useCallback((id: string, tipo: string) => {
    setItens((prev) => prev.filter((i) => !(i.id === id && i.tipo === tipo)));
  }, []);

  const limpar = useCallback(() => {
    setItens([]);
    setValorRecebido("");
    setDetalhesState({ referencia: "", evidencia_url: "", gateway_ref: "" });
  }, []);

  const total = useMemo(() => itens.reduce((acc, item) => acc + item.preco, 0), [itens]);
  const setMetodo = useCallback((next: MetodoPagamento) => {
    setMetodoState(next);
    setValorRecebido(next === "cash" && total > 0 ? String(total) : "");
  }, [total]);

  const valorNum = Number(valorRecebido) || 0;
  const troco = Math.max(0, valorNum - total);

  const prontoParaPagar = useMemo(() => {
    if (itens.length === 0) return false;
    if (metodo === "tpa" && !detalhes.referencia.trim()) return false;
    if (metodo === "transfer" && !detalhes.evidencia_url.trim()) return false;
    if (metodo === "cash" && total > 0 && valorNum < total) return false;
    return true;
  }, [itens.length, metodo, detalhes, total, valorNum]);

  return {
    itens,
    total,
    metodo,
    setMetodo,
    detalhes,
    setDetalhes,
    valorRecebido,
    setValorRecebido,
    valorNum,
    troco,
    prontoParaPagar,
    adicionar,
    remover,
    limpar,
  };
}

function useAuditTrail() {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"aluno" | "todos">("aluno");
  const [entries, setEntries] = useState<Array<{ created_at: string; action: string; entity?: string; portal?: string }>>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (alunoId?: string, matriculaId?: string | null) => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase.from("audit_logs").select("created_at, action, entity, portal").order("created_at", { ascending: false }).limit(15);
      if (scope === "aluno" && alunoId) {
        query = query.eq("entity_id", alunoId);
      }
      const { data } = await query;
      setEntries(
        (data ?? []).map((entry) => ({
          created_at: entry.created_at ?? "",
          action: entry.action ?? "",
          ...(entry.entity ? { entity: entry.entity } : {}),
          ...(entry.portal ? { portal: entry.portal } : {}),
        })),
      );
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  return { open, setOpen, scope, setScope, entries, loading, fetch };
}

function useCheckout({
  escolaId,
  aluno,
  carrinho,
  academicYearId,
  onSuccess,
}: {
  escolaId: string;
  aluno: AlunoDossier | null;
  carrinho: ReturnType<typeof useCarrinho>;
  academicYearId: string | null;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingWindowIssue, setBillingWindowIssue] = useState<BillingWindowIssue | null>(null);
  const [emittingDocId, setEmittingDocId] = useState<string | null>(null);
  const [printQueue, setPrintQueue] = useState<Array<{ label: string; url: string }>>([]);
  const { success, error } = useToast();

  const checkout = useCallback(async (): Promise<boolean> => {
    if (!aluno || !carrinho.prontoParaPagar) return false;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/secretaria/pagamentos/processar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          escola_id: escolaId,
          aluno_id: aluno.id,
          matricula_id: aluno.matricula_id,
          ano_letivo_id: academicYearId,
          metodo_pagamento: carrinho.metodo,
          detalhes: carrinho.detalhes,
          itens: carrinho.itens,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) {
        if (json.code === "MONTH_OUTSIDE_ACADEMIC_YEAR" && json.context?.turma_id) {
          const item = carrinho.itens.find(
            (candidate): candidate is Mensalidade => candidate.tipo === "mensalidade" && candidate.turma_id === json.context.turma_id,
          );
          setBillingWindowIssue({
            turmaId: String(json.context.turma_id),
            turmaLabel: item?.origem_turma || "Turma selecionada",
            anoLetivoId: String(json.context.ano_letivo_id || academicYearId || ""),
            anoLetivoLabel: String(json.context.ano || json.context.ano_letivo_id || academicYearId || "Ano letivo atual"),
            dataInicio: String(json.context.data_inicio_permitida || "").slice(0, 10),
            dataFim: String(json.context.data_fim_permitida || "").slice(0, 10),
            competencia: String(json.context.competencia || ""),
          });
        }
        throw new Error(json.error || "Erro ao processar pagamento");
      }

      if (json.recibo?.print_url) {
        window.open(json.recibo.print_url, "_blank", "noopener,noreferrer");
      }
      success("Pagamento processado com sucesso!");
      setBillingWindowIssue(null);
      carrinho.limpar();
      onSuccess();
      return true;
    } catch (err) {
      error(err instanceof Error ? err.message : "Nao foi possivel concluir o pagamento.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [aluno, carrinho, escolaId, academicYearId, onSuccess, success, error]);

  const saveBillingWindow = useCallback(async (dataFim: string) => {
    if (!billingWindowIssue) return false;
    try {
      const response = await fetch(`/api/secretaria/turmas/${billingWindowIssue.turmaId}/janela-cobranca`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_inicio: billingWindowIssue.dataInicio, data_fim: dataFim }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível guardar a janela.");
      setBillingWindowIssue((current) => current ? { ...current, dataFim } : current);
      success("Janela de cobrança atualizada. Pode tentar o pagamento novamente.");
      return true;
    } catch (err) {
      error(err instanceof Error ? err.message : "Não foi possível guardar a janela.");
      return false;
    }
  }, [billingWindowIssue, error, success]);

  const emitirDocumento = useCallback(
    async (servico: Servico): Promise<string | null> => {
      if (!aluno) return null;
      setEmittingDocId(servico.id);
      try {
        const response = await fetch("/api/secretaria/documentos/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            escola_id: escolaId,
            aluno_id: aluno.id,
            servico_id: servico.id,
            documento_tipo: getDocTipo(servico),
          }),
        });

        const json = await response.json();
        if (!response.ok || !json.url) throw new Error(json.error || "Erro ao emitir documento");
        return json.url;
      } catch (err) {
        error(err instanceof Error ? err.message : "Nao foi possivel emitir o documento.");
        return null;
      } finally {
        setEmittingDocId(null);
      }
    },
    [aluno, escolaId, error]
  );

  return {
    isSubmitting,
    emittingDocId,
    printQueue,
    setPrintQueue,
    checkout,
    emitirDocumento,
    billingWindowIssue,
    setBillingWindowIssue,
    saveBillingWindow,
  };
}

function Avatar({ url, nome, size = "md" }: { url?: string | null; nome?: string | null; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const txt = size === "lg" ? "text-lg" : "text-sm";
  return (
    <div className={`${dim} rounded-2xl bg-klasse-green/10 border border-klasse-green/20 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`font-black text-klasse-green ${txt}`}>{(nome ?? "?").charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "em_dia" | "inadimplente" | "sem_matricula" }) {
  return status === "inadimplente" ? (
    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-wide">
      Inadimplente
    </span>
  ) : status === "sem_matricula" ? (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
      Sem matricula
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-klasse-green/20 bg-klasse-green/10 px-2.5 py-0.5 text-[10px] font-bold text-klasse-green uppercase tracking-wide">
      Em dia
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
      {children}
    </span>
  );
}

function SecaoLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 pl-1 font-mono">
      {children}
    </p>
  );
}

function AlunoCard({ aluno, onTrocarAluno }: { aluno: AlunoDossier; onTrocarAluno: () => void }) {
  const inadimplente = aluno.status_financeiro === "inadimplente";
  const semMatricula = aluno.status_financeiro === "sem_matricula";

  return (
    <div className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3.5 h-fit">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar url={aluno.foto_url} nome={aluno.nome} size="lg" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 font-mono">Situacao</span>
            <StatusPill status={aluno.status_financeiro} />
          </div>
        </div>
      </div>

      <div className="pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-black text-slate-900 leading-snug break-words">{aluno.nome}</h2>
          <button
            type="button"
            onClick={onTrocarAluno}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:border-klasse-gold hover:text-slate-900"
          >
            <ArrowRightLeft className="h-3 w-3" />
            Trocar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
        <Tag>Proc. {aluno.numero_processo}</Tag>
        {aluno.turma_codigo && <Tag>Turma {aluno.turma_codigo}</Tag>}
        {aluno.curso_codigo && <Tag>Curso {aluno.curso_codigo}</Tag>}
        {aluno.classe && <Tag>Classe {aluno.classe}</Tag>}
      </div>

      {inadimplente ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 font-mono">
              Divida acumulada
            </p>
          </div>
          <p className="text-2xl font-black text-rose-700 font-sora">{kwanza.format(aluno.divida_total)}</p>
        </div>
      ) : semMatricula ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center gap-3">
          <div className="p-2 rounded-full bg-slate-200">
            <Info className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Sem matricula neste ano</p>
            <p className="text-[11px] text-slate-500">Nenhuma mensalidade foi lancada.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-klasse-green/20 bg-klasse-green/5 p-3.5 flex items-center gap-3">
          <div className="p-2 rounded-full bg-klasse-green/10">
            <CheckCircle className="h-4 w-4 text-klasse-green" />
          </div>
          <div>
            <p className="text-xs font-bold text-klasse-green">Situacao regular</p>
            <p className="text-[11px] text-klasse-green/70">Nenhuma pendencia.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Catalogo({
  mensalidades,
  servicos,
  onAdicionarMensalidade,
  onAdicionarServico,
  emittingDocId,
  addingServicoId,
  unlockedMensalidadeIds,
  rematriculaReady,
  rematriculaState,
  rematriculaPrice,
  rematriculaDebt,
  rematriculaAnoLabel,
  reconcilingPedido,
  rematriculaError,
  onResolverPedido,
  onResolverReconciliacao,
  onRematricula,
  onRegularize,
}: {
  mensalidades: Mensalidade[];
  servicos: Servico[];
  onAdicionarMensalidade: (m: Mensalidade) => void;
  onAdicionarServico: (s: Servico) => Promise<void>;
  emittingDocId: string | null;
  addingServicoId: string | null;
  unlockedMensalidadeIds: Set<string>;
  rematriculaReady: boolean;
  rematriculaState:
    | "READY"
    | "PRICE_NOT_CONFIGURED"
    | "CHECKING"
    | "RECONFIRMATION_REQUIRED"
    | "FINALIST_PENDING"
    | "LEGACY_REVIEW_REQUIRED"
    | "ALREADY_COMPLETED"
    | "PAYMENT_IN_PROGRESS"
    | "RECONCILIATION_REQUIRED"
    | "DEBT_BLOCKED"
    | null;
  rematriculaPrice: number | null;
  rematriculaDebt: { total: number; count: number } | null;
  rematriculaAnoLabel: string | null;
  reconcilingPedido: boolean;
  rematriculaError: string | null;
  onResolverPedido: () => Promise<void>;
  onResolverReconciliacao: () => Promise<void>;
  onRematricula: () => void;
  onRegularize: () => void;
}) {
  const atrasadas = useMemo(() => mensalidades.filter((m) => m.atrasada), [mensalidades]);
  const correntes = useMemo(() => mensalidades.filter((m) => !m.atrasada), [mensalidades]);
  const documentos = useMemo(
    () => servicos.filter((s) => !isServicoRematricula(s) && isDocServico(s)),
    [servicos],
  );
  const extras = useMemo(
    () => servicos.filter((s) => !isServicoRematricula(s) && !isDocServico(s)),
    [servicos],
  );

  const servicoBtnCls = (busy: boolean) =>
    `p-3 rounded-xl border border-slate-200/90 bg-slate-50/70 text-left transition-all hover:bg-white hover:border-klasse-gold hover:shadow-xs ${
      busy ? "opacity-50 cursor-not-allowed" : ""
    }`;

  return (
    <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-klasse-gold" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Adicionar item</p>
        </div>
      </div>

      <div className="space-y-6 max-h-[620px] overflow-y-auto pr-2">
        {rematriculaState && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <SecaoLabel>Operacoes escolares</SecaoLabel>
              {rematriculaAnoLabel && (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                  Ano: {rematriculaAnoLabel}
                </span>
              )}
            </div>
            {rematriculaState === "LEGACY_REVIEW_REQUIRED" ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <strong className="block text-amber-950">Pedido incompleto encontrado</strong>
                <p className="mt-1">
                  Este pedido não tem ano letivo nem contexto suficiente. Será associado a {rematriculaAnoLabel ?? "o ano letivo atual"} e substituído por uma operação válida, sem cobrança duplicada.
                </p>
                <button
                  type="button"
                  onClick={() => void onResolverPedido()}
                  disabled={reconcilingPedido}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {reconcilingPedido ? "A resolver pedido…" : "Resolver e iniciar operação correta"}
                </button>
              </div>
            ) : null}
            {rematriculaState === "RECONCILIATION_REQUIRED" ? (
              <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <strong className="block">Pagamento recebido — falta concluir a matrícula</strong>
                    <p className="mt-1 text-amber-900/80">
                      Não cobre novamente. O sistema vai reconciliar o pagamento com a matrícula destino e emitir o comprovante.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onResolverReconciliacao()}
                  disabled={reconcilingPedido}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {reconcilingPedido ? "A concluir reconciliação…" : "Concluir reconciliação"}
                </button>
              </div>
            ) : null}
            {rematriculaError ? (
              <p role="alert" className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-800">
                {rematriculaError}
              </p>
            ) : null}
            {rematriculaDebt && rematriculaDebt.total > 0 && (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <strong className="block">Atenção financeira</strong>
                <span>
                  {rematriculaDebt.count} mensalidade(s) em aberto · {kwanza.format(rematriculaDebt.total)}.
                  A dívida deve ser tratada no atendimento; as notas pendentes, por si só, não impedem a progressão quando a secretaria confirmar a aptidão.
                </span>
                {rematriculaState === "DEBT_BLOCKED" && (
                  <button type="button" onClick={onRegularize} className="mt-3 w-full rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700">
                    Regularizar agora
                  </button>
                )}
              </div>
            )}
            {rematriculaState !== "LEGACY_REVIEW_REQUIRED" && <button
              type="button"
              onClick={onRematricula}
              disabled={!rematriculaReady}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border
                border-klasse-green/25 bg-klasse-green/5 hover:bg-klasse-green/10
                transition-all text-left disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div>
                <p className="text-sm font-bold text-klasse-green">
                  {rematriculaState === "RECONFIRMATION_REQUIRED"
                    ? "Reconfirmar matrícula"
                    : rematriculaState === "FINALIST_PENDING"
                      ? "Finalista: decidir continuidade"
                      : "Rematricula escolar"}
                </p>
                <p className="text-xs text-slate-500">
                  {rematriculaReady
                    ? rematriculaState === "RECONFIRMATION_REQUIRED"
                      ? "Pagar taxa e confirmar a matrícula já existente"
                      : rematriculaState === "FINALIST_PENDING"
                        ? "Pagar taxa e escolher continuidade ou conclusão"
                        : "Pagamento, atualizacao da matricula e comprovante"
                    : rematriculaState === "CHECKING"
                      ? "A verificar elegibilidade da matrícula..."
                      : rematriculaState === "ALREADY_COMPLETED"
                        ? "Aluno já possui matrícula neste ano letivo"
                        : rematriculaState === "PAYMENT_IN_PROGRESS"
                          ? "Pagamento de rematrícula já iniciado"
                          : rematriculaState === "RECONCILIATION_REQUIRED"
                            ? "Rematrícula aguarda reconciliação"
                            : rematriculaState === "DEBT_BLOCKED"
                              ? "Regularize as mensalidades em atraso"
                              : "Configure o valor da taxa para ativar esta operacao"}
                </p>
              </div>
              <span className="text-sm font-black text-slate-900 font-sora">
                {rematriculaPrice != null && rematriculaPrice > 0
                  ? kwanza.format(rematriculaPrice)
                  : "Valor pendente"}
              </span>
            </button>}
          </div>
        )}

        {atrasadas.length > 0 && (
          <div>
            <SecaoLabel>Em atraso ({atrasadas.length})</SecaoLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {atrasadas.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onAdicionarMensalidade(m)}
                  disabled={!unlockedMensalidadeIds.has(m.id)}
                  title={!unlockedMensalidadeIds.has(m.id) ? "Regularize primeiro as mensalidades mais antigas." : undefined}
                  className="flex items-center justify-between p-3.5 rounded-xl border
                    border-rose-200 bg-rose-50/70 hover:bg-rose-50 hover:border-rose-300 transition-all text-left group disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-rose-900 truncate">{m.nome}</p>
                    <p className="text-[10px] font-medium text-rose-500 truncate mt-0.5">
                      {[m.origem_ano && `Ano ${m.origem_ano}`, m.origem_turma].filter(Boolean).join(" · ") ||
                        (!unlockedMensalidadeIds.has(m.id) ? "Bloqueada (regularizar anterior)" : "Vencida")}
                    </p>
                  </div>
                  <span className="text-xs font-black text-rose-800 font-sora flex-shrink-0">{kwanza.format(m.preco)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {correntes.length > 0 && (
          <div>
            <SecaoLabel>Mensalidades ({correntes.length})</SecaoLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {correntes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onAdicionarMensalidade(m)}
                  disabled={!unlockedMensalidadeIds.has(m.id)}
                  title={!unlockedMensalidadeIds.has(m.id) ? "Regularize primeiro as mensalidades mais antigas." : undefined}
                  className="flex items-center justify-between p-3.5 rounded-xl border
                    border-slate-200 bg-white hover:border-klasse-gold hover:shadow-xs transition-all text-left group disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900 truncate">{m.nome}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {[m.origem_ano && `Ano ${m.origem_ano}`, m.origem_turma].filter(Boolean).join(" · ") ||
                        (!unlockedMensalidadeIds.has(m.id) ? "Bloqueada (regularizar anterior)" : "Corrente")}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900 font-sora flex-shrink-0">{kwanza.format(m.preco)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {documentos.length > 0 && (
          <div>
            <SecaoLabel>Documentos ({documentos.length})</SecaoLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {documentos.map((s) => {
                const busy = addingServicoId === s.id || emittingDocId === s.id;
                return (
                  <button key={s.id} disabled={busy} onClick={() => void onAdicionarServico(s)} className={servicoBtnCls(busy)}>
                    <p className="text-xs font-bold text-slate-800 truncate" title={s.nome}>
                      {s.nome}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-slate-500 font-sora">{kwanza.format(s.preco)}</span>
                      <span
                        className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                          s.preco > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-klasse-green"
                        }`}
                      >
                        {busy ? "..." : s.preco > 0 ? "Cobrar" : "Adicionar"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {extras.length > 0 && (
          <div>
            <SecaoLabel>Servicos extras ({extras.length})</SecaoLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {extras.map((s) => {
                const busy = addingServicoId === s.id;
                return (
                  <button key={s.id} disabled={busy} onClick={() => void onAdicionarServico(s)} className={servicoBtnCls(busy)}>
                    <p className="text-xs font-bold text-slate-800 truncate" title={s.nome}>
                      {s.nome}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-slate-500 font-sora">{kwanza.format(s.preco)}</span>
                      <span
                        className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                          s.preco > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-klasse-green"
                        }`}
                      >
                        {busy ? "..." : s.preco > 0 ? "Pago" : "Gratis"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mensalidades.length === 0 && servicos.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Nenhum item disponivel para este aluno.</p>
        )}
      </div>
    </div>
  );
}

function AuditTrail({ audit, aluno, onRefresh }: { audit: ReturnType<typeof useAuditTrail>; aluno: AlunoDossier | null; onRefresh: () => void }) {
  if (!audit.open) return null;
  return (
    <div className="border-b border-slate-100">
      <div className="flex items-center justify-between px-6 py-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
          {audit.scope === "aluno" ? "So este aluno" : "Todos"}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => audit.setScope(audit.scope === "aluno" ? "todos" : "aluno")}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700"
          >
            {audit.scope === "aluno" ? "Ver todos" : "Ver aluno"}
          </button>
          <button onClick={onRefresh} className="text-[10px] font-bold uppercase tracking-widest text-klasse-gold hover:underline">
            Actualizar
          </button>
        </div>
      </div>
      <div className="max-h-52 overflow-y-auto px-6 pb-4 space-y-2">
        {!aluno ? (
          <p className="text-xs text-slate-400">Seleccione um aluno para ver o historico.</p>
        ) : audit.loading ? (
          <div className="space-y-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400 mx-auto" />
          </div>
        ) : audit.entries.length === 0 ? (
          <p className="text-xs text-slate-400">Sem registos recentes.</p>
        ) : (
          audit.entries.map((e, i) => (
            <div key={`${e.created_at}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-800">{e.action || "Evento"}</p>
                <p className="text-[10px] text-slate-400 flex-shrink-0 font-mono">
                  {e.created_at
                    ? new Date(e.created_at).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </p>
              </div>
              {(e.entity || e.portal) && <p className="text-[10px] text-slate-500 mt-0.5">{[e.entity, e.portal].filter(Boolean).join(" · ")}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CarrinhoPanel({
  carrinho,
  checkout,
  audit,
  aluno,
  embedded = false,
}: {
  carrinho: ReturnType<typeof useCarrinho>;
  checkout: ReturnType<typeof useCheckout>;
  audit: ReturnType<typeof useAuditTrail>;
  aluno: AlunoDossier | null;
  embedded?: boolean;
}) {
  const { itens, total, metodo, setMetodo, detalhes, setDetalhes, valorRecebido, setValorRecebido, valorNum, troco, prontoParaPagar, remover, limpar } = carrinho;

  const inputCls = `w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-klasse-gold focus:ring-2 focus:ring-klasse-gold/20`;

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col sticky top-6 ${
        embedded ? "h-full min-h-[580px]" : "h-[calc(100vh-140px)]"
      }`}
    >
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-klasse-gold" />
          <span className="text-sm font-bold text-white font-sora">Resumo da venda</span>
          {itens.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-klasse-gold text-[10px] font-black text-slate-900 font-mono">
              {itens.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              audit.setOpen((o) => !o);
              if (!audit.open) void audit.fetch(aluno?.id, aluno?.matricula_id);
            }}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors font-mono"
          >
            {audit.open ? "Fechar audit" : "Audit trail"}
          </button>
          {itens.length > 0 && (
            <button onClick={limpar} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors font-mono">
              Limpar
            </button>
          )}
        </div>
      </div>

      <AuditTrail audit={audit} aluno={aluno} onRefresh={() => void audit.fetch(aluno?.id, aluno?.matricula_id)} />

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
        {itens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
            <ShoppingCart className="h-10 w-10 opacity-30" />
            <p className="text-xs font-medium">Carrinho vazio</p>
          </div>
        ) : (
          itens.map((item) => {
            const podeImprimir = item.tipo === "servico" && Number(item.preco ?? 0) <= 0 && (item as Servico).documento_tipo;

            return (
              <div key={`${item.id}-${item.tipo}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between gap-3 group">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 leading-tight">{item.nome}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 font-mono">{item.tipo}</p>
                  {podeImprimir && (
                    <button
                      type="button"
                      onClick={async () => {
                        const url = await checkout.emitirDocumento(item as Servico);
                        if (url) checkout.setPrintQueue((prev) => [{ label: item.nome, url }, ...prev]);
                      }}
                      className="mt-1.5 text-[10px] font-semibold text-klasse-green hover:underline"
                    >
                      Imprimir agora
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="text-sm font-black text-slate-900 font-sora">{kwanza.format(item.preco)}</p>
                  <button onClick={() => remover(item.id, item.tipo)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 bg-white p-5 space-y-4 flex-shrink-0">
        <div className="flex items-end justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Total a pagar</p>
          <p className="text-3xl font-black text-slate-900 font-sora">{kwanza.format(total)}</p>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {METODOS_UI.map(({ id, icon: Icon, label }) => {
            const active = metodo === id;
            return (
              <button
                key={id}
                onClick={() => setMetodo(id)}
                className={`flex flex-col items-center justify-center py-2.5 rounded-xl border gap-1 transition-all ${
                  active ? "border-klasse-gold bg-klasse-gold/10 text-slate-900 font-bold" : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-klasse-gold" : "text-current"}`} />
                <span className="text-[9px] font-bold uppercase font-mono">{label}</span>
              </button>
            );
          })}
        </div>

        {(metodo === "tpa" || metodo === "mcx" || metodo === "kiwk") && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
              Referencia {metodo === "tpa" && <span className="text-rose-500">*</span>}
            </label>
            <input
              value={detalhes.referencia}
              onChange={(e) => setDetalhes({ referencia: e.target.value })}
              placeholder={metodo === "tpa" ? "TPA-2026-000882" : "Opcional"}
              className={inputCls}
            />
            {(metodo === "mcx" || metodo === "kiwk") && (
              <input
                value={detalhes.gateway_ref}
                onChange={(e) => setDetalhes({ gateway_ref: e.target.value })}
                placeholder="Gateway ref (opcional)"
                className={inputCls}
              />
            )}
          </div>
        )}

        {metodo === "transfer" && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 font-mono">
              Comprovativo (URL) <span className="text-rose-500">*</span>
            </label>
            <input value={detalhes.evidencia_url} onChange={(e) => setDetalhes({ evidencia_url: e.target.value })} placeholder="https://..." className={inputCls} />
          </div>
        )}

        {metodo === "cash" && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Recebido</label>
              {valorNum > total && <span className="text-xs font-bold text-klasse-green">Troco: {kwanza.format(troco)}</span>}
            </div>
            <div className="relative">
              <input
                type="number"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                placeholder="0"
                className={`${inputCls} pr-12 text-lg font-black font-sora`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">KZ</span>
            </div>
          </div>
        )}

        <button
          disabled={!prontoParaPagar || checkout.isSubmitting}
          onClick={() => void checkout.checkout()}
          className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            prontoParaPagar && !checkout.isSubmitting
              ? "bg-klasse-gold text-slate-950 shadow-md shadow-klasse-gold/20 hover:brightness-105 font-sora"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {checkout.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> A processar...
            </>
          ) : total === 0 ? (
            <>
              <Printer className="h-4 w-4" /> Emitir documentos
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" /> Finalizar · {kwanza.format(total)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function BillingWindowRepairPanel({
  issue,
  onClose,
  onSave,
  onRetry,
}: {
  issue: BillingWindowIssue | null;
  onClose: () => void;
  onSave: (dataFim: string) => Promise<boolean>;
  onRetry: () => Promise<boolean>;
}) {
  const [dataFim, setDataFim] = useState(issue?.dataFim ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDataFim(issue?.dataFim ?? "");
  }, [issue]);

  if (!issue) return null;

  const start = issue.dataInicio ? new Date(`${issue.dataInicio}T00:00:00Z`) : null;
  const end = dataFim ? new Date(`${dataFim}T00:00:00Z`) : null;
  const months: string[] = [];
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor <= last && months.length < 24) {
      months.push(new Intl.DateTimeFormat("pt-AO", { month: "short", year: "numeric", timeZone: "UTC" }).format(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  const handleSaveAndRetry = async () => {
    if (!dataFim || dataFim < issue.dataFim) return;
    setSaving(true);
    try {
      if (await onSave(dataFim)) {
        const retried = await onRetry();
        if (retried) onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="billing-window-title">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-klasse-green">Ação de recuperação</p>
            <h2 id="billing-window-title" className="mt-1 text-xl font-black text-slate-900">Configurar janela da turma</h2>
            <p className="mt-1 text-sm text-slate-500">A mensalidade {issue.competencia || "selecionada"} está fora do período permitido.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Turma</p>
            <p className="mt-1 font-bold text-slate-800">{issue.turmaLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ano letivo</p>
            <p className="mt-1 font-bold text-slate-800">{issue.anoLetivoLabel}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Período atual</p>
          <p className="mt-1 text-sm font-semibold text-amber-950">{issue.dataInicio || "—"} até {issue.dataFim || "—"}</p>
          <p className="mt-2 text-xs leading-5 text-amber-800">Para permitir esta cobrança, a data final deve ser igual ou posterior à data final atual. A alteração fica registada na configuração da turma.</p>
        </div>

        <label className="mt-5 block text-sm font-bold text-slate-800" htmlFor="billing-window-end">Data final permitida</label>
        <input
          id="billing-window-end"
          type="date"
          min={issue.dataFim}
          value={dataFim}
          onChange={(event) => setDataFim(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none ring-klasse-green focus:ring-2"
        />

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Prévia das mensalidades</p>
              <p className="text-xs text-slate-500">Competências abrangidas pela janela</p>
            </div>
            <span className="rounded-full bg-klasse-green/10 px-2.5 py-1 text-xs font-bold text-klasse-green">{months.length} meses</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {months.length > 0 ? months.map((month) => (
              <span key={month} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold capitalize text-slate-700">{month}</span>
            )) : <span className="text-xs text-slate-500">Escolha uma data final válida para ver a prévia.</span>}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void handleSaveAndRetry()} disabled={saving || !dataFim || dataFim < issue.dataFim} className="inline-flex items-center justify-center gap-2 rounded-xl bg-klasse-green px-4 py-3 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Guardar e tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BalcaoAtendimento({ escolaId, selectedAlunoId = null, showSearch = true, embedded = false, returnTo = null }: BalcaoAtendimentoProps) {
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const { error } = useToast();
  const searchParams = useSearchParams();
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM);
  const [contextAcademicYearId, setContextAcademicYearId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(showSearch);

  useEffect(() => {
    if (academicYearId) return;

    fetch("/api/academic-context", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setContextAcademicYearId(payload?.context?.anoLetivoId ?? null))
      .catch(() => setContextAcademicYearId(null));
  }, [academicYearId]);

  const effectiveAcademicYearId = academicYearId ?? contextAcademicYearId;

  const search = useAlunoSearch();
  const dossier = useAlunoDossier(escolaId, effectiveAcademicYearId);
  const servicos = useServicos(escolaId);

  const rematricula = useRematriculaBalcao({
    escolaId,
    alunoId: dossier.aluno?.id ?? null,
    matriculaId: dossier.aluno?.matricula_id ?? null,
    academicYearId: effectiveAcademicYearId,
  });
  const carrinho = useCarrinho();
  const audit = useAuditTrail();

  const [addingServicoId] = useState<string | null>(null);
  const [postAction, setPostAction] = useState<{ action: EnrollmentPostAction; turmaId?: string | null } | null>(null);
  const [debtModalOpen, setDebtModalOpen] = useState(false);

  useEffect(() => {
    // Do not leave a blocking, empty debt dialog open after the last payment.
    if (debtModalOpen && rematricula.debt && rematricula.debt.total <= 0) {
      setDebtModalOpen(false);
    }
  }, [debtModalOpen, rematricula.debt]);

  const onCheckoutSuccess = useCallback(() => {
    if (dossier.aluno?.id) {
      void dossier.load(dossier.aluno.id);
      void audit.fetch(dossier.aluno.id, dossier.aluno.matricula_id);
    }
  }, [dossier, audit]);

  const checkout = useCheckout({
    escolaId,
    aluno: dossier.aluno,
    carrinho,
    academicYearId: effectiveAcademicYearId,
    onSuccess: onCheckoutSuccess,
  });

  const selectedMensalidadeIds = useMemo(
    () => carrinho.itens.filter((item): item is Mensalidade => item.tipo === "mensalidade").map((item) => item.id),
    [carrinho.itens]
  );

  const unlockedMensalidadeIds = useMemo(
    () => getUnlockedMensalidadeIds(dossier.mensalidades, selectedMensalidadeIds),
    [dossier.mensalidades, selectedMensalidadeIds]
  );

  useEffect(() => {
    if (!selectedAlunoId) {
      dossier.clear();
      return;
    }
    search.clear();
    void dossier.load(selectedAlunoId);
  }, [selectedAlunoId, effectiveAcademicYearId]);

  useEffect(() => {
    if (dossier.aluno?.id) void audit.fetch(dossier.aluno.id, dossier.aluno.matricula_id);
    else audit.setOpen(false);
  }, [dossier.aluno?.id]);

  const handleSelectAluno = useCallback(
    (alunoId: string) => {
      if (dossier.aluno?.id && dossier.aluno.id !== alunoId) carrinho.limpar();
      void dossier.load(alunoId);
      setSearchOpen(false);
    },
    [carrinho, dossier]
  );

  const handleTrocarAluno = useCallback(() => {
    carrinho.limpar();
    dossier.clear();
    search.clear();
    setSearchOpen(true);
  }, [carrinho, dossier, search]);

  const handleAdicionarMensalidade = useCallback(
    (m: Mensalidade) => {
      carrinho.adicionar(m);
    },
    [carrinho]
  );

  const handleAdicionarServico = useCallback(
    async (s: Servico) => {
      if (!dossier.aluno?.id) {
        error("Selecione um aluno primeiro.");
        return;
      }
      carrinho.adicionar(s);
    },
    [dossier.aluno, carrinho, error]
  );

  return (
    <>
      <div className="w-full">
      {searchOpen && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={search.searchTerm}
              onChange={(e) => {
                search.setSearchTerm(e.target.value);
              }}
              placeholder="Buscar aluno por nome ou n. de processo..."
              className="w-full text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
            {search.isSearching && <Loader2 className="h-4 w-4 animate-spin text-klasse-gold" />}
            {search.searchTerm && (
              <button onClick={search.clear} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {search.alunosEncontrados.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
              {search.alunosEncontrados.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    handleSelectAluno(a.id);
                    search.clear();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <Avatar url={a.foto_url} nome={a.nome} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{a.nome}</p>
                      <p className="text-[10px] text-slate-500 font-mono">Proc. {a.numero_processo}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {dossier.loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 flex flex-col items-center justify-center gap-3 min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-klasse-gold" />
          <p className="text-xs font-bold text-slate-600 font-mono">A carregar ficha do aluno...</p>
        </div>
      ) : dossier.aluno ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <AlunoCard aluno={dossier.aluno} onTrocarAluno={handleTrocarAluno} />
              <Catalogo
                mensalidades={dossier.mensalidades}
                servicos={servicos}
                onAdicionarMensalidade={handleAdicionarMensalidade}
                onAdicionarServico={handleAdicionarServico}
                emittingDocId={checkout.emittingDocId}
                addingServicoId={addingServicoId}
                unlockedMensalidadeIds={unlockedMensalidadeIds}
                rematriculaReady={
                  rematricula.cardState === "READY" ||
                  rematricula.cardState === "RECONFIRMATION_REQUIRED" ||
                  rematricula.cardState === "FINALIST_PENDING"
                }
                rematriculaState={
                  servicos.some(isServicoRematricula)
                    ? rematricula.cardState ?? "CHECKING"
                    : null
                }
                rematriculaPrice={rematricula.service?.valor_base ?? null}
                rematriculaDebt={rematricula.debt}
                rematriculaAnoLabel={rematricula.anoLetivo?.label ?? null}
                reconcilingPedido={rematricula.reconciling}
                rematriculaError={rematricula.apiError}
                onResolverPedido={rematricula.resolveLegacyPedido}
                onResolverReconciliacao={rematricula.resolveReconciliation}
                onRematricula={rematricula.openModal}
                onRegularize={() => {
                  if ((rematricula.debt?.total ?? 0) > 0) setDebtModalOpen(true);
                }}
              />
            </div>
          </div>

          <div className="xl:col-span-4">
            <CarrinhoPanel carrinho={carrinho} checkout={checkout} audit={audit} aluno={dossier.aluno} embedded={embedded} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-16 text-center space-y-2">
          <User className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 font-sora">Nenhum aluno seleccionado</p>
          <p className="text-xs text-slate-400">Utilize a barra de pesquisa acima para abrir a ficha de atendimento do aluno.</p>
        </div>
      )}
      </div>

      {rematricula.modalOpen && rematricula.anoLetivo && rematricula.service && dossier.aluno && (
        <RematriculaBalcaoModal
          open={rematricula.modalOpen}
          onClose={() => {
            rematricula.closeModal();
            if (rematricula.result) void dossier.load(dossier.aluno!.id);
          }}
          alunoNome={dossier.aluno.nome}
          alunoProcesso={dossier.aluno.numero_processo}
          alunoId={dossier.aluno.id}
          escolaId={escolaId}
          turmaAtual={dossier.aluno.turma_codigo ?? null}
          matriculaId={dossier.aluno.matricula_id ?? ""}
          anoLetivo={rematricula.anoLetivo}
          service={rematricula.service}
          debt={rematricula.debt}
          skipTurmaSelection={rematricula.cardState === "RECONFIRMATION_REQUIRED"}
          turmas={rematricula.turmas}
          turmasLoading={rematricula.turmasLoading}
          progressao={rematricula.progressao}
          notasLancarDepois={rematricula.notasLancarDepois}
          setNotasLancarDepois={rematricula.setNotasLancarDepois}
          step={rematricula.step}
          setStep={rematricula.setStep}
          selectedTurmaId={rematricula.selectedTurmaId}
          setSelectedTurmaId={rematricula.setSelectedTurmaId}
          metodo={rematricula.metodo}
          setMetodo={rematricula.setMetodo}
          detalhes={rematricula.detalhes}
          setDetalhes={rematricula.setDetalhes}
          submitting={rematricula.submitting}
          result={rematricula.result}
          apiError={rematricula.apiError}
          submit={rematricula.submit}
          onPostAction={(action, turmaId) => setPostAction({ action, turmaId })}
        />
      )}

      {dossier.aluno && (
        <EnrollmentPostActionModal
          open={Boolean(postAction)}
          onOpenChange={(open) => { if (!open) setPostAction(null); }}
          action={postAction?.action ?? null}
          escolaId={escolaId}
          alunoId={dossier.aluno.id}
          alunoNome={dossier.aluno.nome}
          turmaId={postAction?.turmaId ?? null}
          onPayment={() => {
            setPostAction(null);
            const next = dossier.mensalidades[0];
            if (next) carrinho.adicionar(next);
          }}
        />
      )}

      {dossier.aluno && (
        <PagamentoDividaModal
          open={debtModalOpen}
          onOpenChange={setDebtModalOpen}
          mensalidades={dossier.mensalidades.filter((item) => item.preco > 0 && item.atrasada)}
          alunoId={dossier.aluno.id}
          anoLetivoId={effectiveAcademicYearId}
          onSuccess={() => {
            void dossier.load(dossier.aluno!.id);
            void rematricula.refresh();
            void audit.fetch(dossier.aluno!.id, dossier.aluno!.matricula_id);
          }}
          onFullyPaid={() => {
            setDebtModalOpen(false);
            void rematricula.refresh();
            setShowReturnPrompt(true);
          }}
        />
      )}
      <BillingWindowRepairPanel
        issue={checkout.billingWindowIssue}
        onClose={() => checkout.setBillingWindowIssue(null)}
        onSave={checkout.saveBillingWindow}
        onRetry={checkout.checkout}
      />
      {showReturnPrompt && returnTo && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl">
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-800">Dívida regularizada</p>
            <p className="text-xs text-slate-500">Pode continuar a rematrícula sem perder o contexto.</p>
          </div>
          <Link href={returnTo} className="shrink-0 rounded-xl bg-[#1F6B3B] px-3 py-2 text-xs font-bold text-white hover:brightness-110">
            Continuar
          </Link>
        </div>
      )}
    </>
  );
}
