"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
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
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useToast } from "@/components/feedback/FeedbackSystem";
import { useDebounce } from "@/hooks/useDebounce";
import { createClient } from "@/lib/supabaseClient";
import { useRematriculaBalcao, type RematriculaCardState, type RematriculaPaymentItem } from "@/hooks/useRematriculaBalcao";
import { RematriculaBalcaoModal } from "@/components/secretaria/RematriculaBalcaoModal";
import { EnrollmentPostActionModal } from "@/components/secretaria/EnrollmentPostActionModal";
import type { EnrollmentPostAction } from "@/components/secretaria/EnrollmentPostActions";
import { PagamentoDividaModal } from "@/components/secretaria/PagamentoDividaModal";
import { getTipoDocumentoFromCodigo } from "@/lib/documentos/identificacao";
import { OmniSearchInput } from "@/components/secretaria/OmniSearchInput";
import { isTipoDocumentoEmitivel } from "@/lib/documentos/printUrl";
import { emitirDocumento as emitirDocumentoViaApi, abrirParaImpressao } from "@/lib/documentos/emissaoClient";
import { kwanza } from "@/lib/formatters";
import { resolveCheckoutPaymentState } from "@/lib/financeiro/checkout-payment-state";
import type { BalcaoActionId, BalcaoFocusAction } from "@/lib/balcao/action-registry";
import Link from "next/link";

const ACADEMIC_YEAR_PARAM = "ano_letivo_id";

export type BalcaoView = "all" | "overview" | "payment" | "document" | "reenrollment";

export interface BalcaoAtendimentoProps {
  escolaId: string;
  selectedAlunoId?: string | null;
  showSearch?: boolean;
  embedded?: boolean;
  returnTo?: string | null;
  focusAction?: BalcaoFocusAction | null;
  view?: BalcaoView;
  onNavigateAction?: (actionId: BalcaoActionId) => void;
  /** Chamado após um pagamento concluído com sucesso. A página usa-o para
   *  refrescar o resumo de caixa, que de outra forma ficava parado no valor
   *  carregado na montagem. */
  onPagamentoConcluido?: () => void;
}

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
  telefone_responsavel?: string | null;
  // Campos que só existem no resultado da busca (a rota devolve-os; o dossiê
  // usa `turma_codigo` e `divida_total`). Opcionais para que ambos os
  // consumidores partilhem o mesmo tipo.
  bi_numero?: string | null;
  /** Turma tal como a busca a devolve. */
  turma?: string | null;
  /** Dívida pré-calculada (`vw_financeiro_inadimplencia_top`). 0 = sem dívida
   *  conhecida; o dossiê continua a ser o valor autoritativo. */
  total_em_atraso?: number | null;
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

// Tipo que a API de emissão aceita, ou null se o serviço não emitir documento.
// O código do serviço é configurável por escola e não coincide com o enum da
// API (DOC_DECLARACAO_FREQ, DOC_CERTIFICADO_HABILITACOES, DOC_HISTORICO_ESCOLAR
// não são valores válidos) — daí passar pelo mapa canónico em vez de cortar o
// prefixo DOC_.
function getDocTipo(s: Servico): string | null {
  return getTipoDocumentoFromCodigo(s.documento_tipo ?? s.codigo);
}

// O mapa tipo-de-documento -> segmento de impressão vivia aqui e voltou a ser
// copiado no hub de documentos. Passou para @/lib/documentos/printUrl, que é
// agora a fonte única para os dois.

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
        let targetAcademicYear: number | null = null;
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
            targetAcademicYear = numericYear;
            dossierRpc = "get_aluno_dossier_contextual";
            dossierArgs = { ...dossierArgs, p_ano_letivo: numericYear };
          }
        }

        const baseDossierArgs = { p_escola_id: escolaId, p_aluno_id: alunoId };
        const [contextResult, financialResult] = await Promise.all([
          (supabase as any).rpc(dossierRpc, dossierArgs),
          dossierRpc === "get_aluno_dossier_contextual"
            ? (supabase as any).rpc("get_aluno_dossier", baseDossierArgs)
            : Promise.resolve(null),
        ]);

        if (contextResult.error) throw contextResult.error;
        if (financialResult?.error) throw financialResult.error;

        const raw = (contextResult.data ?? {}) as any;
        const financialRaw = (financialResult?.data ?? raw) as any;
        const perfil = raw.perfil ?? raw.aluno ?? {};
        const financeiro = financialRaw.financeiro ?? raw.financeiro ?? {};
        const historico = Array.isArray(raw.historico) ? raw.historico : [];
        const atual = raw.matricula_ativa ?? historico[0] ?? {};
        const divida = Number(financeiro.total_em_atraso ?? raw.aluno?.divida_total ?? 0);
        let matriculaOrigem = historico
          .filter((item: any) => targetAcademicYear !== null && Number(item.ano_letivo) < targetAcademicYear)
          .sort((a: any, b: any) => Number(b.ano_letivo ?? 0) - Number(a.ano_letivo ?? 0))[0] ?? null;
        if (targetAcademicYear !== null) {
          const { data: previousMatricula } = await supabase
            .from("matriculas")
            .select("id, ano_letivo, status, turma_id")
            .eq("escola_id", escolaId)
            .eq("aluno_id", alunoId)
            .lt("ano_letivo", targetAcademicYear)
            .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada", "transferido"])
            .order("ano_letivo", { ascending: false })
            .limit(1)
            .maybeSingle();
          matriculaOrigem = previousMatricula ?? matriculaOrigem;
        }

        // The dossier header must describe the active/current registration.
        // The previous matrícula is kept separately for the rematricula
        // operation; mixing its turma with the current classe produced e.g.
        // “Turma 2ª Classe” alongside “Classe 3ª Classe”.
        const turmaAtualId = atual.turma_id ?? matriculaOrigem?.turma_id ?? null;
        let turmaAtualCodigo = atual.turma_codigo ? String(atual.turma_codigo) : null;
        if (!turmaAtualCodigo && turmaAtualId) {
          const { data: turmaOrigem } = await supabase
            .from("turmas")
            .select("nome, turma_codigo")
            .eq("escola_id", escolaId)
            .eq("id", turmaAtualId)
            .maybeSingle();
          turmaAtualCodigo = turmaOrigem
            ? String(turmaOrigem.turma_codigo ?? turmaOrigem.nome ?? "Turma")
            : null;
        }

        setAluno({
          id: String(raw.aluno?.id ?? alunoId),
          nome: String(perfil.nome_completo ?? perfil.nome ?? raw.aluno?.nome ?? "Aluno"),
          foto_url: perfil.foto_url ? String(perfil.foto_url) : null,
          numero_processo: String(perfil.numero_processo ?? raw.aluno?.numero_processo ?? "-"),
          turma_codigo: turmaAtualCodigo,
          curso_codigo: atual.curso_codigo ? String(atual.curso_codigo) : null,
          classe: atual.classe ? String(atual.classe) : null,
          status_financeiro: divida > 0 ? "inadimplente" : "em_dia",
          divida_total: divida,
          telefone_responsavel: perfil.telefone_responsavel ?? perfil.responsavel_contato ?? perfil.encarregado_telefone ?? null,
          // The dossier RPC returns the active registration as `{ id }`;
          // older payloads used `{ matricula_id }`. The rematricula status
          // endpoint needs the registration UUID in either case.
          matricula_id: matriculaOrigem?.id
            ? String(matriculaOrigem.id)
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

  // Último alvo pedido. Sem isto, alternar o âmbito não conseguia reler: quem
  // chama teria de repetir os argumentos, e a closure ainda teria o `scope`
  // antigo (o setState é assíncrono).
  const alvoRef = useRef<{ alunoId?: string; matriculaId?: string | null }>({});

  const carregar = useCallback(
    async (alvo: { alunoId?: string; matriculaId?: string | null }, ambito: "aluno" | "todos") => {
      setLoading(true);
      try {
        const supabase = createClient();
        let query = supabase.from("audit_logs").select("created_at, action, entity, portal").order("created_at", { ascending: false }).limit(15);
        if (ambito === "aluno" && alvo.alunoId) {
          query = query.eq("entity_id", alvo.alunoId);
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
    },
    []
  );

  const fetch = useCallback(async (alunoId?: string, matriculaId?: string | null) => {
    alvoRef.current = { alunoId, matriculaId };
    await carregar({ alunoId, matriculaId }, scope);
  }, [carregar, scope]);

  /** Alterna o âmbito E relê. Antes só mudava o rótulo, deixando a lista com os
   *  registos do âmbito anterior. */
  const alternarScope = useCallback(async () => {
    const novo = scope === "aluno" ? "todos" : "aluno";
    setScope(novo);
    await carregar(alvoRef.current, novo);
  }, [carregar, scope]);

  return { open, setOpen, scope, setScope, alternarScope, entries, loading, fetch };
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
  const checkoutRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const documentRequestRef = useRef<Map<string, { fingerprint: string; key: string }>>(new Map());
  // Serviços que emitem documento e acabaram de ser pagos. O carrinho é limpo no
  // sucesso, e sem isto o item pago desaparecia do ecrã sem forma de emitir o
  // documento — que é exactamente o que faltava ao pagar uma declaração.
  const [pagos, setPagos] = useState<Servico[]>([]);
  const [pendentes, setPendentes] = useState<Servico[]>([]);
  const { success, error } = useToast();

  const checkout = useCallback(async (): Promise<boolean> => {
    if (!aluno || !carrinho.prontoParaPagar) return false;
    setIsSubmitting(true);

    try {
      const checkoutPayload = {
        escola_id: escolaId,
        aluno_id: aluno.id,
        matricula_id: aluno.matricula_id,
        ano_letivo_id: academicYearId,
        metodo_pagamento: carrinho.metodo,
        detalhes: carrinho.detalhes,
        itens: carrinho.itens,
      };
      const fingerprint = JSON.stringify(checkoutPayload);
      if (!checkoutRequestRef.current || checkoutRequestRef.current.fingerprint !== fingerprint) {
        checkoutRequestRef.current = {
          fingerprint,
          key: crypto.randomUUID(),
        };
      }

      const response = await fetch("/api/secretaria/pagamentos/processar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": checkoutRequestRef.current.key,
        },
        body: JSON.stringify(checkoutPayload),
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
        // Antes isto era um `window.open` sem verificação nenhuma: com popups
        // bloqueados o comprovativo de um pagamento já recebido desaparecia sem
        // qualquer aviso. Agora, se não abrir, fica na fila de impressão.
        const impressao = abrirParaImpressao(String(json.recibo.print_url));
        if (!impressao.ok) {
          setPrintQueue((prev) => [
            { label: `Recibo — ${aluno.nome}`, url: impressao.url },
            ...prev,
          ]);
        }
      }
      const documentosDoCheckout = carrinho.itens.filter(
        (item): item is Servico => item.tipo === "servico" && getDocTipo(item) !== null,
      );
      const settlement = resolveCheckoutPaymentState(json);

      if (settlement.state === "settled") {
        setPagos(documentosDoCheckout);
        setPendentes([]);
        success("Pagamento confirmado com sucesso.");
      } else {
        // O backend pode aceitar/registar uma transação que ainda não está
        // liquidada (TPA, transferência, MCX/Kwik). Isso NÃO libera o documento.
        setPagos([]);
        setPendentes(documentosDoCheckout);
        success(
          settlement.state === "pending"
            ? "Pagamento registado. Aguarda validação antes de liberar documentos."
            : "Pagamento registado. Confirme o estado antes de emitir documentos.",
        );
      }
      setBillingWindowIssue(null);
      checkoutRequestRef.current = null;
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

      const tipoDocumento = getDocTipo(servico);
      if (!tipoDocumento) {
        error(`O serviço "${servico.nome}" não tem um documento associado.`);
        return null;
      }
      // `getTipoDocumentoFromCodigo` pode devolver tipos que a rota de emissão
      // não aceita — "recibo" é o caso real, e existe no catálogo de serviços.
      // Sem esta guarda o POST devolvia 400 e o operador via um erro genérico.
      if (!isTipoDocumentoEmitivel(tipoDocumento)) {
        error(`O serviço "${servico.nome}" é emitido pelo fluxo de pagamento, não pelo balcão.`);
        return null;
      }

      const fingerprint = JSON.stringify({
        escolaId,
        alunoId: aluno.id,
        servicoId: servico.id,
        tipoDocumento,
        anoLetivoId: academicYearId ?? null,
      });
      const previousRequest = documentRequestRef.current.get(servico.id);
      const request =
        previousRequest?.fingerprint === fingerprint
          ? previousRequest
          : { fingerprint, key: crypto.randomUUID() };
      documentRequestRef.current.set(servico.id, request);

      setEmittingDocId(servico.id);
      try {
        const resultado = await emitirDocumentoViaApi({
          escolaId,
          alunoId: aluno.id,
          tipoDocumento,
          idempotencyKey: request.key,
          anoLetivoId: academicYearId,
        });
        if (!resultado.ok) {
          // A chave permanece associada à tentativa: retry após timeout/500 não
          // pode fabricar um segundo documento oficial.
          error(resultado.error);
          return null;
        }
        documentRequestRef.current.delete(servico.id);
        return resultado.printUrl;
      } finally {
        setEmittingDocId(null);
      }
    },
    [aluno, escolaId, academicYearId, error]
  );

  return {
    isSubmitting,
    emittingDocId,
    printQueue,
    setPrintQueue,
    pagos,
    setPagos,
    pendentes,
    setPendentes,
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
    <div className={`${dim} rounded-2xl bg-emerald/10 border border-emerald/20 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`font-black text-emerald ${txt}`}>{(nome ?? "?").charAt(0).toUpperCase()}</span>
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
    <span className="inline-flex items-center rounded-full border border-emerald/20 bg-emerald/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald uppercase tracking-wide">
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

/**
 * Código interno do estado da rematrícula, em monoespaçado e discreto.
 *
 * Existe para que quem está ao balcão possa dizer ao suporte exactamente em que
 * estado o sistema parou, sem que esse jargão ocupe o lugar do título — que
 * passa a ser uma frase em português corrente.
 */
function CodigoEstado({ estado }: { estado: string }) {
  return (
    <span className="mt-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-amber-800">
      {estado}
    </span>
  );
}

type OperacaoCopy = {
  /** Título em português corrente — o que está a acontecer. */
  titulo: string;
  /** O que o operador deve fazer a seguir. */
  descricao: string;
};

/**
 * Texto de cada estado de rematrícula.
 *
 * Antes vivia numa cadeia de ternários aninhados dentro do JSX, onde o estado
 * interno (`DEBT_BLOCKED`, `SOURCE_RECORD_REQUIRED`, …) aparecia como
 * diagnóstico. Aqui cada estado tem título e instrução próprios, e um `Record`
 * sobre a união garante que acrescentar um estado ao hook sem lhe dar texto
 * não compila.
 */
const ESTADO_OPERACAO: Record<RematriculaCardState | "CHECKING", OperacaoCopy> = {
  READY: {
    titulo: "Rematrícula escolar",
    descricao: "O RAA autorizou a progressão e não há saldo em aberto. Selecione a turma destino e conclua.",
  },
  ACADEMIC_PENDING: {
    titulo: "Notas ou dados académicos ainda pendentes",
    descricao: "Conclua o fecho académico e verifique novamente.",
  },
  ACADEMIC_REVIEW_REQUIRED: {
    titulo: "Recurso académico pendente",
    descricao: "O RAA exige concluir ou acompanhar o recurso antes de efetivar a rematrícula.",
  },
  ACADEMIC_CONDITIONAL_BLOCKED: {
    titulo: "Inscrição condicional ainda bloqueada",
    descricao: "O RAA reconhece a progressão condicional, mas a efetivação ainda depende da resolução indicada.",
  },
  ACADEMIC_ATTENDANCE_REVIEW_REQUIRED: {
    titulo: "Retenção por faltas em validação",
    descricao: "Reveja a frequência e a regra escolar antes de autorizar a nova matrícula na mesma classe.",
  },
  ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED: {
    titulo: "Decisão disciplinar necessária",
    descricao: "A retenção por indisciplina exige decisão administrativa antes de qualquer nova matrícula.",
  },
  ACADEMIC_NOT_APPROVED: {
    titulo: "Decisão RAA não autoriza progressão",
    descricao: "A decisão académica vigente não permite efetivar a rematrícula para a etapa seguinte.",
  },
  ACADEMIC_CYCLE_COMPLETED: {
    titulo: "Ciclo académico concluído",
    descricao: "Não há rematrícula para a classe seguinte; siga para o fecho e documentos finais.",
  },
  RECONFIRMATION_REQUIRED: {
    titulo: "Pagar taxa de rematrícula",
    descricao: "O aluno já está matriculado; cobra-se apenas a taxa, sem alterar turma ou classe.",
  },
  DOCUMENT_PENDING: {
    titulo: "Emitir comprovativo pendente",
    descricao: "O pagamento e o recibo já foram confirmados; falta apenas emitir o comprovativo.",
  },
  ACADEMIC_HISTORY_PENDING: {
    titulo: "Reconciliar histórico académico",
    descricao: "A matrícula e o pagamento estão concluídos. Falta apenas registar o fecho académico da matrícula de origem.",
  },
  FINALIST_PENDING: {
    titulo: "Finalista: decidir continuidade",
    descricao: "Cobrar a taxa e escolher entre continuar os estudos ou concluir.",
  },
  CHECKING: {
    titulo: "A verificar se o aluno pode ser rematriculado…",
    descricao: "Aguarde alguns segundos; esta leitura é automática.",
  },
  ALREADY_COMPLETED: {
    titulo: "Rematrícula já concluída neste ano letivo",
    descricao: "Não há nada a cobrar — o aluno já está matriculado.",
  },
  DEBT_BLOCKED: {
    titulo: "Saldo em aberto impede a rematrícula",
    descricao: "Regularize todos os saldos da matrícula de origem antes de continuar.",
  },
  PRICE_NOT_CONFIGURED: {
    titulo: "Taxa de rematrícula sem valor definido",
    descricao: "Defina o valor da taxa nas configurações da escola para ativar esta operação.",
  },
  SOURCE_RECORD_REQUIRED: {
    titulo: "Falta a matrícula de origem",
    descricao: "Não se encontra a matrícula anterior deste aluno; regularize o vínculo de origem antes de continuar.",
  },
  WINDOW_CLOSED: {
    titulo: "O período de rematrícula está fechado",
    descricao: "Abra uma janela de rematrícula para este ano letivo antes de iniciar novas operações.",
  },
  PAYMENT_IN_PROGRESS: {
    titulo: "Pagamento de rematrícula já iniciado",
    descricao: "Não será criada nova cobrança; confirme a liquidação no aviso acima.",
  },
  PENDING_ORDER_REVIEW: {
    titulo: "Pagamento iniciado mas não liquidado",
    descricao: "Resolva o pedido pendente no aviso acima antes de cobrar.",
  },
  RECONCILIATION_REQUIRED: {
    titulo: "Pagamento recebido — falta concluir a matrícula",
    descricao: "Registe a decisão académica no aviso acima para concluir.",
  },
  LEGACY_REVIEW_REQUIRED: {
    titulo: "Pedido antigo por resolver",
    descricao: "Resolva o pedido no aviso acima antes de iniciar a rematrícula.",
  },
  ERROR: {
    titulo: "Não foi possível verificar a rematrícula",
    descricao: "Consulte a mensagem acima. Se o erro persistir, tente novamente mais tarde.",
  },
};

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
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:border-amber hover:text-slate-900"
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
        <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-3.5 flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald/10">
            <CheckCircle className="h-4 w-4 text-emerald" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald">Situacao regular</p>
            <p className="text-[11px] text-emerald/70">Nenhuma pendencia.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Catalogo({
  mensalidades,
  servicos,
  view = "all",
  onAdicionarMensalidade,
  onAdicionarServico,
  emittingDocId,
  unlockedMensalidadeIds,
  rematriculaReady,
  rematriculaState,
  rematriculaPrice,
  rematriculaAnoLabel,
  rematriculaAcademic,
  reconcilingPedido,
  rematriculaError,
  onResolverPedido,
  onResolverReconciliacao,
  onCancelPendingPedido,
  onRefreshRematricula,
  onRematricula,
  onRegularize,
}: {
  mensalidades: Mensalidade[];
  servicos: Servico[];
  view?: "all" | "payment" | "document" | "reenrollment";
  onAdicionarMensalidade: (m: Mensalidade) => void;
  onAdicionarServico: (s: Servico) => Promise<void>;
  emittingDocId: string | null;
  unlockedMensalidadeIds: Set<string>;
  rematriculaReady: boolean;
  /** `CHECKING` é rótulo sintético do cliente, para o intervalo antes de a
   *  primeira leitura da elegibilidade responder. */
  rematriculaState: RematriculaCardState | "CHECKING" | null;
  rematriculaPrice: number | null;
  rematriculaAnoLabel: string | null;
  rematriculaAcademic: {
    reason?: string;
    disciplina_ids_pendentes?: string[];
  } | null | undefined;
  reconcilingPedido: boolean;
  rematriculaError: string | null;
  onResolverPedido: () => Promise<void>;
  onResolverReconciliacao: () => void;
  onCancelPendingPedido: () => Promise<void>;
  onRefreshRematricula: () => Promise<unknown>;
  onRematricula: () => void;
  onRegularize: () => void;
}) {
  const atrasadas = useMemo(() => mensalidades.filter((m) => m.atrasada), [mensalidades]);
  const dividaHistorica = useMemo(() => ({
    count: atrasadas.length,
    total: atrasadas.reduce((total, mensalidade) => total + mensalidade.preco, 0),
  }), [atrasadas]);
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
    `p-3 rounded-xl border border-slate-200/90 bg-slate-50/70 text-left transition-all hover:bg-white hover:border-amber hover:shadow-xs ${
      busy ? "opacity-50 cursor-not-allowed" : ""
    }`;

  const operacaoCopy = rematriculaState ? ESTADO_OPERACAO[rematriculaState] : null;

  return (
    <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-amber" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Adicionar item</p>
        </div>
      </div>

      {/* O limite de altura só faz sentido quando o catálogo é uma coluna ao
          lado da ficha do aluno (`xl`). Empilhado, o scroll interno só servia
          para esconder o botão de pagar. */}
      <div className="space-y-6 xl:max-h-[620px] xl:overflow-y-auto xl:pr-2">
        {(view === "all" || view === "payment") && dividaHistorica.total > 0 && (
          <div data-balcao-action="payment" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <strong className="block">Atenção financeira</strong>
            <span>
              {dividaHistorica.count} mensalidade(s) vencida(s) · {kwanza.format(dividaHistorica.total)}.
              A regularização segue da mensalidade mais antiga para a mais recente.
            </span>
            <button
              type="button"
              onClick={onRegularize}
              className="mt-3 w-full rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700"
            >
              Regularizar agora
            </button>
          </div>
        )}
        {(view === "all" || view === "reenrollment") && rematriculaState && (
          <div data-balcao-action="reenrollment">
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
                <strong className="block text-amber-950">Pedido antigo por resolver</strong>
                <p className="mt-1">
                  Existe um pedido de rematrícula anterior sem ano letivo associado. Vai ser ligado a{" "}
                  {rematriculaAnoLabel ?? "o ano letivo atual"} e substituído por uma operação válida —
                  o aluno <strong>não paga duas vezes</strong>.
                </p>
                <CodigoEstado estado="LEGACY_REVIEW_REQUIRED" />
                <button
                  type="button"
                  onClick={() => void onResolverPedido()}
                  disabled={reconcilingPedido}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {reconcilingPedido ? "A resolver o pedido…" : "Resolver e iniciar a rematrícula"}
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
                      Não cobre novamente. Escolha a turma/classe de destino e conclua a matrícula
                      neste mesmo atendimento.
                    </p>
                    <CodigoEstado estado="RECONCILIATION_REQUIRED" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onResolverReconciliacao()}
                  disabled={reconcilingPedido}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {reconcilingPedido ? "A concluir a matrícula…" : "Registar decisão e concluir a matrícula"}
                </button>
              </div>
            ) : null}
            {rematriculaState === "PENDING_ORDER_REVIEW" ? (
              <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <strong className="block">Pagamento iniciado mas não liquidado</strong>
                    <p className="mt-1 text-amber-900/80">
                      Ficou uma tentativa de pagamento aberta, sem dinheiro recebido nem comprovativo.
                      Cancele-a aqui e cobre de novo — <strong>o aluno não paga duas vezes</strong>.
                    </p>
                    <CodigoEstado estado="PENDING_ORDER_REVIEW" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onCancelPendingPedido()}
                  disabled={reconcilingPedido}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {reconcilingPedido ? "A cancelar a tentativa…" : "Cancelar a tentativa e cobrar agora"}
                </button>
              </div>
            ) : null}
            {rematriculaState === "PAYMENT_IN_PROGRESS" ? (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                <div className="flex items-start gap-2">
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <strong className="block">Pagamento de rematrícula já iniciado</strong>
                    <p className="mt-1 text-amber-900/80">
                      Já existe um pagamento a decorrer, por isso não se cria outro. Confirme aqui se
                      o dinheiro entrou; se ainda não entrou, aguarde a validação.
                    </p>
                    <CodigoEstado estado="PAYMENT_IN_PROGRESS" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onRefreshRematricula()}
                  disabled={reconcilingPedido}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${reconcilingPedido ? "animate-spin" : ""}`} />
                  {reconcilingPedido ? "A confirmar o pagamento…" : "Confirmar pagamento"}
                </button>
              </div>
            ) : null}
            {rematriculaState === "WINDOW_CLOSED" ? (
              <div className="mb-2 rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs text-slate-700">
                <strong className="block text-slate-900">Período de rematrícula fechado</strong>
                <p className="mt-1">
                  A escola ainda não tem uma janela de rematrícula aberta para{" "}
                  {rematriculaAnoLabel ?? "este ano letivo"}. Abra-a antes de iniciar novas operações.
                </p>
                <CodigoEstado estado="WINDOW_CLOSED" />
              </div>
            ) : null}
            {rematriculaState === "ACADEMIC_PENDING" ? (
              <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
                <strong className="block">Rematrícula bloqueada: faltam notas ou dados académicos</strong>
                <p className="mt-1 text-amber-900/80">
                  Não existe bypass por “lançar depois”. Conclua os dados exigidos pelo RAA e verifique novamente.
                </p>
                <CodigoEstado estado="ACADEMIC_PENDING" />
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link href="/secretaria/notas" className="rounded-xl bg-amber-700 px-3 py-2 text-center font-bold text-white hover:bg-amber-800">
                    Abrir notas
                  </Link>
                  <button type="button" onClick={() => void onRefreshRematricula()} className="rounded-xl border border-amber-300 bg-white px-3 py-2 font-bold text-amber-900 hover:bg-amber-100">
                    Verificar novamente
                  </button>
                </div>
              </div>
            ) : null}
            {rematriculaState === "ACADEMIC_REVIEW_REQUIRED" ? (
              <div className="mb-2 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-xs text-sky-950">
                <strong className="block">Recurso académico em aberto</strong>
                <p className="mt-1 text-sky-900/80">
                  {rematriculaAcademic?.reason ?? "O RAA ainda não autorizou a efetivação da rematrícula."}
                </p>
                {(rematriculaAcademic?.disciplina_ids_pendentes?.length ?? 0) > 0 ? (
                  <p className="mt-2 font-semibold">
                    Disciplinas pendentes: {rematriculaAcademic?.disciplina_ids_pendentes?.length}
                  </p>
                ) : null}
                <CodigoEstado estado="ACADEMIC_REVIEW_REQUIRED" />
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link href="/secretaria/raa/reapreciacoes" className="rounded-xl bg-sky-700 px-3 py-2 text-center font-bold text-white hover:bg-sky-800">
                    Abrir recursos
                  </Link>
                  <button type="button" onClick={() => void onRefreshRematricula()} className="rounded-xl border border-sky-200 bg-white px-3 py-2 font-bold text-sky-900 hover:bg-sky-100">
                    Verificar novamente
                  </button>
                </div>
              </div>
            ) : null}
            {rematriculaState === "ACADEMIC_CONDITIONAL_BLOCKED" ? (
              <div className="mb-2 rounded-xl border border-violet-200 bg-violet-50 p-3.5 text-xs text-violet-950">
                <strong className="block">Inscrição condicional reconhecida, mas ainda não efetivável</strong>
                <p className="mt-1 text-violet-900/80">
                  {rematriculaAcademic?.reason ?? "O RAA exige resolver a pendência académica antes da ativação da matrícula."}
                </p>
                {(rematriculaAcademic?.disciplina_ids_pendentes?.length ?? 0) > 0 ? (
                  <p className="mt-2 font-semibold">
                    Disciplinas pendentes: {rematriculaAcademic?.disciplina_ids_pendentes?.length}
                  </p>
                ) : null}
                <CodigoEstado estado="ACADEMIC_CONDITIONAL_BLOCKED" />
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link href="/secretaria/raa/reapreciacoes" className="rounded-xl bg-violet-700 px-3 py-2 text-center font-bold text-white hover:bg-violet-800">
                    Resolver pendência
                  </Link>
                  <button type="button" onClick={() => void onRefreshRematricula()} className="rounded-xl border border-violet-200 bg-white px-3 py-2 font-bold text-violet-900 hover:bg-violet-100">
                    Verificar novamente
                  </button>
                </div>
              </div>
            ) : null}
            {rematriculaState === "ACADEMIC_ATTENDANCE_REVIEW_REQUIRED" ? (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                <strong className="block">Retenção por faltas — validar regra escolar</strong>
                <p className="mt-1 text-amber-900/80">
                  O aluno não pode ser rematriculado automaticamente. Confirme frequência e a regra aplicável antes de autorizar a repetição.
                </p>
                <CodigoEstado estado="ACADEMIC_ATTENDANCE_REVIEW_REQUIRED" />
                <Link href="/secretaria/operacoes-academicas/fechamento-academico" className="mt-3 block rounded-xl bg-amber-700 px-3 py-2 text-center font-bold text-white hover:bg-amber-800">
                  Rever frequência e decisão
                </Link>
              </div>
            ) : null}
            {rematriculaState === "ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED" ? (
              <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-950">
                <strong className="block">Retenção por indisciplina — decisão administrativa</strong>
                <p className="mt-1 text-rose-900/80">
                  O Balcão não deve criar automaticamente uma nova matrícula enquanto a decisão disciplinar aplicável não estiver concluída.
                </p>
                <CodigoEstado estado="ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED" />
                <Link href="/secretaria/raa/indisciplina" className="mt-3 block rounded-xl bg-rose-700 px-3 py-2 text-center font-bold text-white hover:bg-rose-800">
                  Abrir decisão disciplinar
                </Link>
              </div>
            ) : null}
            {rematriculaState === "ACADEMIC_NOT_APPROVED" ? (
              <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
                <strong className="block">Resultado académico não autoriza rematrícula</strong>
                <p className="mt-1 text-rose-800/80">
                  O Balcão não altera a decisão académica. Reveja o resultado no RAA e corrija somente dados comprovadamente incorretos.
                </p>
                <CodigoEstado estado="ACADEMIC_NOT_APPROVED" />
                <Link href="/secretaria/fechamento-academico" className="mt-3 block rounded-xl bg-rose-700 px-3 py-2 text-center font-bold text-white hover:bg-rose-800">
                  Abrir fechamento académico
                </Link>
              </div>
            ) : null}
            {rematriculaState === "ACADEMIC_CYCLE_COMPLETED" ? (
              <div className="mb-2 rounded-xl border border-violet-200 bg-violet-50 p-3.5 text-xs text-violet-950">
                <strong className="block">Ciclo concluído — não há rematrícula seguinte</strong>
                <p className="mt-1 text-violet-900/80">
                  O aluno terminou a etapa académica. O próximo passo é o fecho documental, não uma nova rematrícula.
                </p>
                <CodigoEstado estado="ACADEMIC_CYCLE_COMPLETED" />
                <Link href="/secretaria/documentos-oficiais" className="mt-3 block rounded-xl bg-violet-700 px-3 py-2 text-center font-bold text-white hover:bg-violet-800">
                  Abrir documentos oficiais
                </Link>
              </div>
            ) : null}
            {rematriculaError ? (
              <p role="alert" className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-800">
                {rematriculaError}
              </p>
            ) : null}
            {rematriculaState && operacaoCopy &&
              !(["LEGACY_REVIEW_REQUIRED", "PENDING_ORDER_REVIEW"] as string[]).includes(rematriculaState) && <button
              type="button"
              onClick={onRematricula}
              disabled={!rematriculaReady}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border
                border-emerald/25 bg-emerald/5 hover:bg-emerald/10
                transition-all text-left disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div>
                <p className="text-sm font-bold text-emerald">{operacaoCopy.titulo}</p>
                <p className="text-xs text-slate-500">{operacaoCopy.descricao}</p>
              </div>
              <span className="text-sm font-black text-slate-900 font-sora">
                {rematriculaPrice != null && rematriculaPrice > 0
                  ? kwanza.format(rematriculaPrice)
                  : "Valor pendente"}
              </span>
            </button>}
          </div>
        )}

        {(view === "all" || view === "payment") && atrasadas.length > 0 && (
          <div data-balcao-action="payment">
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

        {(view === "all" || view === "payment") && correntes.length > 0 && (
          <div data-balcao-action="payment">
            <SecaoLabel>Mensalidades ({correntes.length})</SecaoLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {correntes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onAdicionarMensalidade(m)}
                  disabled={!unlockedMensalidadeIds.has(m.id)}
                  title={!unlockedMensalidadeIds.has(m.id) ? "Regularize primeiro as mensalidades mais antigas." : undefined}
                  className="flex items-center justify-between p-3.5 rounded-xl border
                    border-slate-200 bg-white hover:border-amber hover:shadow-xs transition-all text-left group disabled:cursor-not-allowed disabled:opacity-60"
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

        {(view === "all" || view === "document") && documentos.length > 0 && (
          <div data-balcao-action="document">
            <SecaoLabel>Documentos ({documentos.length})</SecaoLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {documentos.map((s) => {
                const busy = emittingDocId === s.id;
                return (
                  <button key={s.id} disabled={busy} onClick={() => void onAdicionarServico(s)} className={servicoBtnCls(busy)}>
                    <p className="text-xs font-bold text-slate-800 truncate" title={s.nome}>
                      {s.nome}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-slate-500 font-sora">{kwanza.format(s.preco)}</span>
                      <span
                        className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                          s.preco > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald"
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

        {(view === "all" || view === "payment") && extras.length > 0 && (
          <div>
            <SecaoLabel>Servicos extras ({extras.length})</SecaoLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {extras.map((s) => (
                // Os mesmos dois casos diziam "Pago"/"Gratis" aqui e
                // "Cobrar"/"Adicionar" nos Documentos — "Pago" sugeria um
                // pagamento já feito, quando o serviço ainda não foi cobrado.
                <button key={s.id} onClick={() => void onAdicionarServico(s)} className={servicoBtnCls(false)}>
                  <p className="text-xs font-bold text-slate-800 truncate" title={s.nome}>
                    {s.nome}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-slate-500 font-sora">{kwanza.format(s.preco)}</span>
                    <span
                      className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                        s.preco > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald"
                      }`}
                    >
                      {s.preco > 0 ? "Cobrar" : "Adicionar"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "payment" && mensalidades.length === 0 && extras.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nenhuma cobrança disponível para este aluno.</p>
        ) : null}
        {view === "document" && documentos.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nenhum documento configurado para este aluno.</p>
        ) : null}
        {view === "reenrollment" && !rematriculaState ? (
          <p className="py-8 text-center text-sm text-slate-400">A rematrícula não está disponível neste contexto.</p>
        ) : null}
        {view === "all" && mensalidades.length === 0 && servicos.length === 0 && (
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
            onClick={() => void audit.alternarScope()}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700"
          >
            {audit.scope === "aluno" ? "Ver todos" : "Ver aluno"}
          </button>
          <button onClick={onRefresh} className="text-[10px] font-bold uppercase tracking-widest text-amber hover:underline">
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
                        timeZone: "Africa/Luanda",
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
  atalhoActivo = true,
}: {
  carrinho: ReturnType<typeof useCarrinho>;
  checkout: ReturnType<typeof useCheckout>;
  audit: ReturnType<typeof useAuditTrail>;
  aluno: AlunoDossier | null;
  embedded?: boolean;
  /** Desligado enquanto há um modal aberto — ver o efeito abaixo. */
  atalhoActivo?: boolean;
}) {
  const { itens, total, metodo, setMetodo, detalhes, setDetalhes, valorRecebido, setValorRecebido, valorNum, troco, prontoParaPagar, remover, limpar } = carrinho;

  const inputCls = `w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-amber focus:ring-2 focus:ring-amber/20`;

  /**
   * Cmd/Ctrl+Enter finaliza o pagamento — o operador tem as duas mãos no teclado
   * e não devia ter de ir ao rato entre o aluno e o botão.
   *
   * Fica desligado enquanto há um modal aberto: o Enter pertence ao diálogo, e
   * disparar um checkout por trás dele cobraria o aluno enquanto o operador
   * decide outra coisa. O ouvinte está em `window` porque o foco tanto pode
   * estar no valor recebido como no campo de detalhes.
   */
  useEffect(() => {
    if (!atalhoActivo) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Enter" || !(evento.metaKey || evento.ctrlKey)) return;
      if (!prontoParaPagar || checkout.isSubmitting) return;
      // A busca de alunos também é um campo de texto, e aí o Cmd/Ctrl+Enter lê-se
      // como "procurar". Como isto cobra dinheiro, qualquer região onde o atalho
      // signifique outra coisa marca-se com `data-atalho-pagamento="off"` e fica
      // de fora.
      const alvo = evento.target;
      if (alvo instanceof Element && alvo.closest('[data-atalho-pagamento="off"]')) return;
      evento.preventDefault();
      void checkout.checkout();
    };

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [atalhoActivo, prontoParaPagar, checkout.isSubmitting, checkout.checkout]);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col sticky top-6 ${
        embedded ? "h-full min-h-[580px]" : "h-[calc(100vh-140px)]"
      }`}
    >
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-amber" />
          <span className="text-sm font-bold text-white font-sora">Resumo da venda</span>
          {itens.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-black text-slate-900 font-mono">
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
        {itens.length === 0 && checkout.pagos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
            <ShoppingCart className="h-10 w-10 opacity-30" />
            <p className="text-xs font-medium">Carrinho vazio</p>
          </div>
        ) : (
          itens.map((item) => {
            const podeImprimir = item.tipo === "servico" && Number(item.preco ?? 0) <= 0 && getDocTipo(item as Servico) !== null;

            return (
              <div key={`${item.id}-${item.tipo}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between gap-3 group">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 leading-tight">{item.nome}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 font-mono">{item.tipo}</p>
                  {podeImprimir && (
                    <button
                      type="button"
                      disabled={checkout.emittingDocId === item.id}
                      onClick={async () => {
                        const url = await checkout.emitirDocumento(item as Servico);
                        if (!url) return;
                        const impressao = abrirParaImpressao(url);
                        if (!impressao.ok) checkout.setPrintQueue((prev) => [{ label: item.nome, url: impressao.url }, ...prev]);
                      }}
                      className="mt-1.5 text-[10px] font-semibold text-emerald hover:underline disabled:opacity-50"
                    >
                      {checkout.emittingDocId === item.id ? "A emitir…" : "Imprimir agora"}
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

        {checkout.pendentes.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-800 font-mono">
                <AlertCircle className="h-3.5 w-3.5" />
                Pagamento registado — aguarda validação
              </p>
              <button
                type="button"
                onClick={() => checkout.setPendentes([])}
                className="text-amber-700/70 hover:text-amber-900 transition-colors"
                aria-label="Fechar aviso de pagamento pendente"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-amber-900/80">
              O pagamento ainda não está confirmado. O documento só será liberado depois da liquidação.
            </p>
            {checkout.pendentes.map((servico) => (
              <div key={servico.id} className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-semibold text-slate-700">{servico.nome}</p>
                <span className="flex-shrink-0 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Aguardando
                </span>
              </div>
            ))}
          </div>
        )}

        {checkout.pagos.length > 0 && (
          <div className="bg-emerald/5 border border-emerald/25 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald font-mono flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Pago — emitir documento
              </p>
              <button
                type="button"
                onClick={() => checkout.setPagos([])}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {checkout.pagos.map((servico) => (
              <div key={servico.id} className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-700 min-w-0 truncate">{servico.nome}</p>
                <button
                  type="button"
                  disabled={checkout.emittingDocId === servico.id}
                  onClick={async () => {
                    const url = await checkout.emitirDocumento(servico);
                    if (!url) return;
                    const impressao = abrirParaImpressao(url);
                    if (!impressao.ok) checkout.setPrintQueue((prev) => [{ label: servico.nome, url: impressao.url }, ...prev]);
                  }}
                  className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald hover:underline disabled:opacity-50"
                >
                  {checkout.emittingDocId === servico.id ? "A emitir…" : "Emitir documento"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Fila de impressão: o caminho de recuperação quando o browser bloqueia
            a abertura automática. Até aqui era escrita e nunca renderizada, por
            isso um documento emitido (e por vezes já pago) ficava inalcançável.
            São links normais, e não window.open, precisamente porque um clique
            do utilizador não é bloqueado. */}
        {checkout.printQueue.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 font-mono flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                {checkout.printQueue.length === 1
                  ? "1 documento por imprimir"
                  : `${checkout.printQueue.length} documentos por imprimir`}
              </p>
              <button
                type="button"
                onClick={() => checkout.setPrintQueue([])}
                className="text-amber-600/70 hover:text-amber-800 transition-colors"
                aria-label="Limpar fila de impressão"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-amber-800/80">
              O browser bloqueou a abertura automática. Abra cada documento a partir daqui.
            </p>
            {checkout.printQueue.map((entrada, indice) => (
              <div key={`${entrada.url}-${indice}`} className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-700 min-w-0 truncate">{entrada.label}</p>
                <a
                  href={entrada.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => checkout.setPrintQueue((prev) => prev.filter((_, i) => i !== indice))}
                  className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-700 hover:underline"
                >
                  Abrir
                </a>
              </div>
            ))}
          </div>
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
                  active ? "border-amber bg-amber/10 text-slate-900 font-bold" : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-amber" : "text-current"}`} />
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
              {valorNum > total && <span className="text-xs font-bold text-emerald">Troco: {kwanza.format(troco)}</span>}
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
          title={prontoParaPagar ? "Finalizar (Ctrl/Cmd + Enter)" : undefined}
          className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            prontoParaPagar && !checkout.isSubmitting
              ? "bg-amber text-slate-950 shadow-md shadow-amber/20 hover:brightness-105 font-sora"
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
        {prontoParaPagar && !checkout.isSubmitting && (
          <p className="mt-1.5 text-center text-[10px] font-medium text-slate-400">
            ou <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">Ctrl</kbd>
            {" + "}
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">Enter</kbd>
          </p>
        )}
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
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald">Ação de recuperação</p>
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
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none ring-emerald focus:ring-2"
        />

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Prévia das mensalidades</p>
              <p className="text-xs text-slate-500">Competências abrangidas pela janela</p>
            </div>
            <span className="rounded-full bg-emerald/10 px-2.5 py-1 text-xs font-bold text-emerald">{months.length} meses</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {months.length > 0 ? months.map((month) => (
              <span key={month} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold capitalize text-slate-700">{month}</span>
            )) : <span className="text-xs text-slate-500">Escolha uma data final válida para ver a prévia.</span>}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void handleSaveAndRetry()} disabled={saving || !dataFim || dataFim < issue.dataFim} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-3 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Guardar e tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BalcaoAtendimento({
  escolaId,
  selectedAlunoId = null,
  showSearch = true,
  embedded = false,
  returnTo = null,
  focusAction = null,
  view = "all",
  onNavigateAction,
  onPagamentoConcluido,
}: BalcaoAtendimentoProps) {
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const { error } = useToast();
  const searchParams = useSearchParams();
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM);
  const [contextAcademicYearId, setContextAcademicYearId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(showSearch);
  const [searchListOpen, setSearchListOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const workspaceRootRef = useRef<HTMLDivElement | null>(null);

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
  const carrinho = useCarrinho();
  // Itens escolhidos dentro da rematrícula pertencem ao pagamento dessa
  // operação, não ao carrinho genérico do balcão.
  const [itensRematricula, setItensRematricula] = useState<RematriculaPaymentItem[]>([]);
  const [mensalidadesDestino, setMensalidadesDestino] = useState<RematriculaPaymentItem[]>([]);

  const rematricula = useRematriculaBalcao({
    escolaId,
    alunoId: dossier.aluno?.id ?? null,
    matriculaId: dossier.aluno?.matricula_id ?? null,
    academicYearId: effectiveAcademicYearId,
    responsavelContato: dossier.aluno?.telefone_responsavel ?? null,
    itensPagamento: itensRematricula,
  });
  const audit = useAuditTrail();

  const [postAction, setPostAction] = useState<{ action: EnrollmentPostAction; turmaId?: string | null } | null>(null);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const hasOverdueDebt = useMemo(
    () => dossier.mensalidades.some((item) => item.preco > 0 && item.atrasada),
    [dossier.mensalidades]
  );

  useEffect(() => {
    // Do not leave a blocking, empty debt dialog open after the last payment.
    if (debtModalOpen && !dossier.loading && !hasOverdueDebt) {
      setDebtModalOpen(false);
    }
  }, [debtModalOpen, dossier.loading, hasOverdueDebt]);

  const onCheckoutSuccess = useCallback(() => {
    if (dossier.aluno?.id) {
      void dossier.load(dossier.aluno.id);
      void audit.fetch(dossier.aluno.id, dossier.aluno.matricula_id);
    }
    onPagamentoConcluido?.();
  }, [dossier, audit, onPagamentoConcluido]);

  const checkout = useCheckout({
    escolaId,
    aluno: dossier.aluno,
    carrinho,
    academicYearId: effectiveAcademicYearId,
    onSuccess: onCheckoutSuccess,
  });

  const selectedMensalidadeIds = useMemo(
    () => [...carrinho.itens, ...itensRematricula]
      .filter((item): item is Mensalidade => item.tipo === "mensalidade")
      .map((item) => item.id),
    [carrinho.itens, itensRematricula]
  );

  const unlockedMensalidadeIds = useMemo(
    () => getUnlockedMensalidadeIds(dossier.mensalidades, selectedMensalidadeIds),
    [dossier.mensalidades, selectedMensalidadeIds]
  );

  useEffect(() => {
    const turmaId = rematricula.selectedTurmaId;
    if (!turmaId || !effectiveAcademicYearId) {
      setMensalidadesDestino([]);
      setItensRematricula((current) => current.filter((item) => !item.previsto));
      return;
    }

    const controller = new AbortController();
    setItensRematricula((current) => current.filter((item) => !item.previsto));

    void (async () => {
      try {
        const params = new URLSearchParams({
          escola_id: escolaId,
          turma_id: turmaId,
          session_id: effectiveAcademicYearId,
        });
        const response = await fetch(`/api/financeiro/orcamento/matricula?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true) {
          setMensalidadesDestino([]);
          return;
        }

        const rows = Array.isArray(payload?.data?.mensalidades) ? payload.data.mensalidades : [];
        setMensalidadesDestino(rows
          .filter((item: any) => typeof item?.competencia === "string" && Number(item?.valor ?? 0) > 0)
          .map((item: any) => ({
            id: `destino:${item.competencia}`,
            tipo: "mensalidade" as const,
            nome: `Propina ${item.competencia}`,
            preco: Number(item.valor),
            quantidade: 1,
            competencia: String(item.competencia),
            data_vencimento: String(item.data_vencimento ?? ""),
            previsto: true,
          })));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMensalidadesDestino([]);
        }
      }
    })();

    return () => controller.abort();
  }, [effectiveAcademicYearId, escolaId, rematricula.selectedTurmaId]);

  const itensDisponiveisNaRematricula = useMemo<RematriculaPaymentItem[]>(() => [
    ...mensalidadesDestino,
    ...servicos.filter((servico) => ["DOC_CARTAO_ESTUDANTE", "SERV_UNIFORME"].includes(servico.codigo.trim().toUpperCase())),
  ], [mensalidadesDestino, servicos]);

  useEffect(() => {
    setItensRematricula([]);
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

  const handleSelectAluno = (alunoId: string) => {
    if (dossier.aluno?.id && dossier.aluno.id !== alunoId) {
      carrinho.limpar();
      checkout.setPagos([]);
      checkout.setPendentes([]);
      checkout.setPrintQueue([]);
    }
    setItensRematricula([]);
    void dossier.load(alunoId);
    setSearchOpen(false);
  };

  const handleTrocarAluno = () => {
    carrinho.limpar();
    checkout.setPagos([]);
    checkout.setPendentes([]);
    checkout.setPrintQueue([]);
    setItensRematricula([]);
    dossier.clear();
    search.clear();
    setSearchListOpen(false);
    setSearchActiveIndex(-1);
    setSearchOpen(true);
  };

  // A busca devolve `turma`/`bi_numero`/`total_em_atraso`; o dossiê usa outros
  // nomes. O adaptador concentra essa diferença aqui em vez de a espalhar pelo
  // componente partilhado.
  const resultadosBusca = useMemo(
    () =>
      search.alunosEncontrados.map((a) => ({
        id: a.id,
        nome: a.nome,
        numero_processo: a.numero_processo,
        bi_numero: a.bi_numero ?? null,
        turma_atual: a.turma ?? a.turma_codigo ?? null,
        total_em_atraso: a.total_em_atraso ?? null,
        foto_url: a.foto_url ?? null,
      })),
    [search.alunosEncontrados]
  );

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

  useEffect(() => {
    if (!focusAction || !dossier.aluno?.id) return;

    const timer = window.setTimeout(() => {
      const target = workspaceRootRef.current?.querySelector<HTMLElement>(
        `[data-balcao-action="${focusAction}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 160);

    return () => window.clearTimeout(timer);
  }, [
    focusAction,
    dossier.aluno?.id,
    dossier.mensalidades.length,
    servicos.length,
    rematricula.cardState,
  ]);

  return (
    <>
      <div ref={workspaceRootRef} className="w-full">
      {searchOpen && (
        <>
          <div
            data-atalho-pagamento="off"
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <OmniSearchInput
              query={search.searchTerm}
              setQuery={search.setSearchTerm}
              results={resultadosBusca}
              loading={search.isSearching}
              onSelect={(aluno) => {
                handleSelectAluno(aluno.id);
                search.clear();
                setSearchListOpen(false);
                setSearchActiveIndex(-1);
              }}
              open={searchListOpen}
              setOpen={setSearchListOpen}
              activeIndex={searchActiveIndex}
              setActiveIndex={setSearchActiveIndex}
              placeholder="Buscar aluno por nome, processo ou BI..."
              size="md"
              autoFocus
            />
          </div>
          {searchListOpen && (
            <div className="fixed inset-0 z-30" onClick={() => setSearchListOpen(false)} />
          )}
        </>
      )}

      {dossier.loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 flex flex-col items-center justify-center gap-3 min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-amber" />
          <p className="text-xs font-bold text-slate-600 font-mono">A carregar ficha do aluno...</p>
        </div>
      ) : dossier.aluno ? (
        /* A partir de `lg` o carrinho passa a ficar ao lado e o botão de pagar
           deixa de exigir scroll. A ficha do aluno e o catálogo só se separam em
           `xl`: a 1024px não há largura para três colunas. */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <AlunoCard aluno={dossier.aluno} onTrocarAluno={handleTrocarAluno} />
              <Catalogo
                mensalidades={dossier.mensalidades}
                servicos={servicos}
                onAdicionarMensalidade={handleAdicionarMensalidade}
                onAdicionarServico={handleAdicionarServico}
                emittingDocId={checkout.emittingDocId}
                unlockedMensalidadeIds={unlockedMensalidadeIds}
                rematriculaReady={
                  rematricula.cardState === "READY" ||
                  rematricula.cardState === "RECONFIRMATION_REQUIRED" ||
                  rematricula.cardState === "DOCUMENT_PENDING" ||
                  rematricula.cardState === "ACADEMIC_HISTORY_PENDING" ||
                  rematricula.cardState === "FINALIST_PENDING"
                }
                rematriculaState={
                  servicos.some(isServicoRematricula)
                    ? rematricula.cardState ?? (rematricula.apiError ? "ERROR" : "CHECKING")
                    : null
                }
                rematriculaPrice={rematricula.service?.valor_base ?? null}
                rematriculaAnoLabel={rematricula.anoLetivo?.label ?? null}
                rematriculaAcademic={rematricula.academic}
                reconcilingPedido={rematricula.reconciling}
                rematriculaError={rematricula.apiError}
                onResolverPedido={rematricula.resolveLegacyPedido}
                onResolverReconciliacao={rematricula.openReconciliationModal}
                onCancelPendingPedido={rematricula.cancelPendingPedido}
                onRefreshRematricula={rematricula.refreshStatus}
                onRematricula={rematricula.openModal}
                onRegularize={() => setDebtModalOpen(true)}
              />
            </div>
          </div>

          <div className="lg:col-span-4">
            <CarrinhoPanel
              carrinho={carrinho}
              checkout={checkout}
              audit={audit}
              aluno={dossier.aluno}
              embedded={embedded}
              atalhoActivo={
                !rematricula.modalOpen &&
                !debtModalOpen &&
                !postAction &&
                !checkout.billingWindowIssue
              }
            />
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
            setItensRematricula([]);
            if (rematricula.result) {
              void dossier.load(dossier.aluno!.id);
            }
          }}
          alunoNome={dossier.aluno.nome}
          alunoProcesso={dossier.aluno.numero_processo}
          turmaAtual={dossier.aluno.turma_codigo ?? null}
          matriculaId={dossier.aluno.matricula_id ?? ""}
          responsavelContato={rematricula.responsavelContato}
          setResponsavelContato={rematricula.setResponsavelContato}
          anoLetivo={rematricula.anoLetivo}
          service={rematricula.service}
          itensPagamento={itensRematricula}
          itensDisponiveis={itensDisponiveisNaRematricula}
          paymentAlreadyValidated={rematricula.cardState === "DOCUMENT_PENDING" || rematricula.cardState === "ACADEMIC_HISTORY_PENDING"}
          onAdicionarItem={(item) => setItensRematricula((previous) => (
            previous.some((selected) => selected.id === item.id && selected.tipo === item.tipo)
              ? previous
              : [...previous, item]
          ))}
          onRemoverItem={(id, tipo) => setItensRematricula((previous) => (
            previous.filter((item) => !(item.id === id && item.tipo === tipo))
          ))}
          debt={rematricula.debt}
          cohort={rematricula.cohort}
          reconciliationOnly={rematricula.reconciliationMode}
          onRegularizeDebt={() => setDebtModalOpen(true)}
          skipTurmaSelection={
            rematricula.cardState === "RECONFIRMATION_REQUIRED" ||
            rematricula.cardState === "DOCUMENT_PENDING" ||
            rematricula.cardState === "ACADEMIC_HISTORY_PENDING"
          }
          turmas={rematricula.turmas}
          turmasLoading={rematricula.turmasLoading}
          progressao={rematricula.progressao}
          decisaoResultado={rematricula.decisaoResultado}
          setDecisaoResultado={rematricula.setDecisaoResultado}
          decisaoFonte={rematricula.decisaoFonte}
          setDecisaoFonte={rematricula.setDecisaoFonte}
          decisaoMotivo={rematricula.decisaoMotivo}
          setDecisaoMotivo={rematricula.setDecisaoMotivo}
          decisaoObservacao={rematricula.decisaoObservacao}
          setDecisaoObservacao={rematricula.setDecisaoObservacao}
          step={rematricula.step}
          setStep={rematricula.setStep}
          selectedTurmaId={rematricula.selectedTurmaId}
          setSelectedTurmaId={rematricula.setSelectedTurmaId}
          destinoTurma={rematricula.destinoTurma}
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
