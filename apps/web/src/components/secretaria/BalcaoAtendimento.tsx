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
  Plus,
  Loader2,
  Smartphone,
  Wallet,
  X,
  User
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { BalcaoServicoModal, type BalcaoDecision } from "@/components/secretaria/BalcaoServicoModal";
import { MotivoBloqueioModal } from "@/components/secretaria/MotivoBloqueioModal";

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

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
  turma_codigo?: string | null;
  classe?: string | null;
  curso?: string | null;
  curso_codigo?: string | null;
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
  codigo: string;
  nome: string;
  preco: number;
  tipo: "servico";
  descricao?: string | null;
  documento_tipo?: DocumentoTipo | null;
  pedido_id?: string | null;
  pagamento_intent_id?: string | null;
}

type DocumentoTipo =
  | "declaracao_frequencia"
  | "declaracao_notas"
  | "cartao_estudante"
  | "ficha_inscricao";

interface AuditEntry {
  created_at: string;
  portal: string | null;
  action: string | null;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
}

type ItemCarrinho = Mensalidade | Servico;

interface BalcaoAtendimentoProps {
  escolaId: string;
  selectedAlunoId?: string | null;
  showSearch?: boolean;
  embedded?: boolean;
}

function formatMesAno(mes?: number, ano?: number) {
  if (!mes || mes < 1 || mes > 12 || !ano) return "Mensalidade";
  const label = new Date(0, mes - 1).toLocaleString("pt-PT", { month: "short" });
  return `Mensalidade ${label}/${ano}`;
}

function normalizeQuery(q: string) {
  return q.trim();
}

function isDocumentoServico(servico: Servico) {
  const codigo = (servico.codigo ?? "").toLowerCase();
  const nome = (servico.nome ?? "").toLowerCase();
  const descricao = (servico.descricao ?? "").toLowerCase();
  const haystack = `${codigo} ${nome} ${descricao}`;
  return [
    "doc",
    "declaracao",
    "declaração",
    "documento",
    "certificado",
    "cartao",
    "cartão",
    "ficha",
  ].some((token) => haystack.includes(token));
}

function getDocumentoTipo(servico: Servico): DocumentoTipo | null {
  const codigo = (servico.codigo ?? "").toLowerCase();
  const nome = (servico.nome ?? "").toLowerCase();
  const descricao = (servico.descricao ?? "").toLowerCase();
  const haystack = `${codigo} ${nome} ${descricao}`;

  if (haystack.includes("nota")) return "declaracao_notas";
  if (haystack.includes("frequencia") || haystack.includes("freq")) return "declaracao_frequencia";
  if (haystack.includes("cartao") || haystack.includes("cartão")) return "cartao_estudante";
  if (haystack.includes("ficha") || haystack.includes("inscricao")) return "ficha_inscricao";
  return null;
}

function getDocumentoDestino(docId: string, tipo: DocumentoTipo) {
  if (tipo === "declaracao_frequencia") return `/secretaria/documentos/${docId}/frequencia/print`;
  if (tipo === "declaracao_notas") return `/secretaria/documentos/${docId}/notas/print`;
  if (tipo === "cartao_estudante") return `/secretaria/documentos/${docId}/cartao/print`;
  return `/secretaria/documentos/${docId}/ficha/print`;
}

// CORREÇÃO 1: Status Pill usando Token KLASSE (Verde) e Vermelho Padrão (Erro)
function StatusPill({ status }: { status: "em_dia" | "inadimplente" }) {
  const bad = status === "inadimplente";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        bad
          ? "border-red-200 bg-red-50 text-red-700" // Vermelho Financeiro
          : "border-[#1F6B3B]/20 bg-[#1F6B3B]/10 text-[#1F6B3B]" // Verde Brand
      )}
    >
      {bad ? "Inadimplente" : "Em dia"}
    </span>
  );
}

function SkeletonLine() {
  return <div className="h-3 w-full animate-pulse rounded-full bg-slate-200" />;
}

export default function BalcaoAtendimento({
  escolaId,
  selectedAlunoId = null,
  showSearch = true,
  embedded = false,
}: BalcaoAtendimentoProps) {
  const supabase = createClient();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [alunosEncontrados, setAlunosEncontrados] = useState<AlunoBusca[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoDossier | null>(null);

  const [mensalidadesDisponiveis, setMensalidadesDisponiveis] = useState<Mensalidade[]>([]);
  const [servicosDisponiveis, setServicosDisponiveis] = useState<Servico[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const [metodo, setMetodo] = useState<MetodoPagamento>("cash");
  const [valorRecebido, setValorRecebido] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentEvidenceUrl, setPaymentEvidenceUrl] = useState("");
  const [paymentGatewayRef, setPaymentGatewayRef] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [alunoDossierLoading, setAlunoDossierLoading] = useState(false);
  const [servicoModalOpen, setServicoModalOpen] = useState(false);
  const [servicoModalCodigo, setServicoModalCodigo] = useState<string | null>(null);
  const [emittingDocId, setEmittingDocId] = useState<string | null>(null);
  const [addingServicoId, setAddingServicoId] = useState<string | null>(null);
  const [printQueue, setPrintQueue] = useState<Array<{ label: string; url: string }>>([]);
  const [bloqueioInfo, setBloqueioInfo] = useState<{ code: string; detail?: string } | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [auditFeed, setAuditFeed] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditScope, setAuditScope] = useState<"aluno" | "todos">("aluno");
  const [auditOpen, setAuditOpen] = useState(false);

  const abortSearchRef = useRef<AbortController | null>(null);


  // --- Load serviços (catálogo) ---
  useEffect(() => {
    let mounted = true;
    async function loadServicos() {
      const { data, error } = await supabase
        .from("servicos_escola")
        .select("id, codigo, nome, descricao, valor_base")
        .eq("escola_id", escolaId)
        .eq("ativo", true);

      if (!mounted) return;

      if (error) {
        console.error(error);
        toast.error("Erro ao carregar serviços.");
        setServicosDisponiveis([]);
        return;
      }
      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        codigo: row.codigo,
        nome: row.nome,
        descricao: row.descricao,
        preco: Number(row.valor_base ?? 0),
        tipo: "servico" as const,
      }));
      setServicosDisponiveis(mapped);
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
          turma_codigo: atual?.turma_codigo ?? atual?.turma_code ?? null,
          classe: atual?.classe ?? null,
          curso: atual?.curso ?? atual?.curso_nome ?? null,
          curso_codigo: atual?.curso_codigo ?? atual?.curso_code ?? null,
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
        setMetodo("cash");
        setValorRecebido("");
        setPaymentReference("");
        setPaymentEvidenceUrl("");
        setPaymentGatewayRef("");
      } finally {
        setAlunoDossierLoading(false);
      }
    },
    [supabase, escolaId]
  );

  useEffect(() => {
    if (!selectedAlunoId) {
      setAlunoSelecionado(null);
      setMensalidadesDisponiveis([]);
      setCarrinho([]);
      return;
    }
    setSearchTerm("");
    setAlunosEncontrados([]);
    void loadAlunoDossier(selectedAlunoId);
  }, [selectedAlunoId, loadAlunoDossier]);

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
    setPaymentReference("");
    setPaymentEvidenceUrl("");
    setPaymentGatewayRef("");
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
    carrinho.length > 0 &&
    (total === 0 || (metodo !== "cash" || (valorRecebidoNum > 0 && valorRecebidoNum >= total)));

  const fetchAuditFeed = useCallback(
    async (alunoId?: string | null, matriculaId?: string | null) => {
      setAuditLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (auditScope === "aluno") {
        if (alunoId) params.set("alunoId", alunoId);
        if (matriculaId) params.set("matriculaId", matriculaId ?? "");
      }

      const res = await fetch(`/api/secretaria/balcao/audit?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      setAuditLoading(false);

      if (!res.ok || !json?.ok) {
        console.error(json?.error || "Falha ao carregar audit trail.");
        setAuditFeed([]);
        return;
      }

      setAuditFeed(Array.isArray(json.logs) ? (json.logs as AuditEntry[]) : []);
    },
    [auditScope]
  );

  useEffect(() => {
    if (metodo === "cash") {
      setPaymentReference("");
      setPaymentEvidenceUrl("");
      setPaymentGatewayRef("");
      return;
    }
    if (metodo === "transfer") {
      setPaymentReference("");
      setPaymentGatewayRef("");
      return;
    }
    if (metodo === "tpa") {
      setPaymentEvidenceUrl("");
      setPaymentGatewayRef("");
      return;
    }
    setPaymentEvidenceUrl("");
  }, [metodo]);

  // --- Checkout ---
  const handleCheckout = async () => {
    if (!alunoSelecionado?.id) return toast.error("Nenhum aluno selecionado.");
    if (carrinho.length === 0) return toast.error("Carrinho vazio.");

    const mensalidadesCarrinho = carrinho.filter(
      (item): item is Mensalidade => item.tipo === "mensalidade"
    );
    const servicosCarrinho = carrinho.filter(
      (item): item is Servico => item.tipo === "servico"
    );

    if (total === 0) {
      const documentosGratis = servicosCarrinho.filter((servico) => servico.documento_tipo);
      if (documentosGratis.length === 0) {
        return toast.error("Nada para emitir.");
      }
      setIsSubmitting(true);
      try {
        for (const servico of documentosGratis) {
          await handleEmitDocumento(servico, { openInNewTab: true });
        }
        toast.success("Documento emitido.");
        limparCarrinho();
        await loadAlunoDossier(alunoSelecionado.id);
        await fetchAuditFeed(alunoSelecionado.id, alunoSelecionado.matricula_id);
      } catch (e: any) {
        toast.error(e?.message || "Erro ao emitir documento.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (total === 0) {
      const documentosGratis = servicosCarrinho.filter((servico) => servico.documento_tipo);
      if (documentosGratis.length === 0) {
        return toast.error("Nada para emitir.");
      }
      setIsSubmitting(true);
      try {
        const novosLinks: Array<{ label: string; url: string }> = [];
        for (const servico of documentosGratis) {
          const url = await handleEmitDocumento(servico, { openInNewTab: true });
          if (url) {
            novosLinks.push({ label: servico.nome, url });
          }
        }
        toast.success("Documento emitido.");
        if (novosLinks.length > 0) {
          setPrintQueue((prev) => [...novosLinks, ...prev]);
        }
        limparCarrinho();
        await loadAlunoDossier(alunoSelecionado.id);
        await fetchAuditFeed(alunoSelecionado.id, alunoSelecionado.matricula_id);
      } catch (e: any) {
        toast.error(e?.message || "Erro ao emitir documento.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (total > 0) {
      if (metodo === "cash" && valorRecebidoNum < total) {
        return toast.error("Valor recebido insuficiente.");
      }

      if (metodo === "tpa" && !paymentReference.trim()) {
        return toast.error("Referência obrigatória para TPA.");
      }

      if (metodo === "transfer" && !paymentEvidenceUrl.trim()) {
        return toast.error("Comprovativo obrigatório para Transferência.");
      }
    }

    setIsSubmitting(true);
    try {
      for (const mensalidade of mensalidadesCarrinho) {
        const idempotencyKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const response = await fetch("/api/secretaria/balcao/pagamentos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          cache: "no-store",
          body: JSON.stringify({
            aluno_id: alunoSelecionado.id,
            mensalidade_id: mensalidade.id,
            valor: mensalidade.preco,
            metodo,
            reference: paymentReference || null,
            evidence_url: paymentEvidenceUrl || null,
            gateway_ref: paymentGatewayRef || null,
            meta: { observacao: "Pagamento via balcão" },
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao registrar pagamento.");
        }
      }

      for (const servico of servicosCarrinho) {
        if ((servico.preco ?? 0) <= 0) continue;
        const idempotencyKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const response = await fetch("/api/secretaria/balcao/pagamentos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          cache: "no-store",
          body: JSON.stringify({
            aluno_id: alunoSelecionado.id,
            mensalidade_id: null,
            valor: servico.preco,
            metodo,
            reference: paymentReference || null,
            evidence_url: paymentEvidenceUrl || null,
            gateway_ref: paymentGatewayRef || null,
            meta: {
              observacao: "Pagamento via balcão",
              pedido_id: servico.pedido_id ?? null,
              pagamento_intent_id: servico.pagamento_intent_id ?? null,
              servico_codigo: servico.codigo,
              documento_tipo: servico.documento_tipo ?? null,
            },
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao registrar pagamento.");
        }
      }

      const documentosParaEmitir = servicosCarrinho.filter(
        (servico) => servico.documento_tipo && (servico.preco ?? 0) > 0
      );
      if (documentosParaEmitir.length > 0) {
        const novosLinks: Array<{ label: string; url: string }> = [];
        for (const servico of documentosParaEmitir) {
          const url = await handleEmitDocumento(servico, { openInNewTab: true });
          if (url) {
            novosLinks.push({ label: servico.nome, url });
          }
        }
        if (novosLinks.length > 0) {
          setPrintQueue((prev) => [...novosLinks, ...prev]);
        }
      }

      const successMessage =
        total === 0
          ? "Documento emitido."
          : metodo === "cash"
          ? `Pagamento registrado. Troco: ${kwanza.format(troco)}`
          : "Pagamento registrado.";
      toast.success(successMessage);
      setPaymentFeedback({ status: "success", message: successMessage });

      limparCarrinho();
      await loadAlunoDossier(alunoSelecionado.id);
      await fetchAuditFeed(alunoSelecionado.id, alunoSelecionado.matricula_id);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao finalizar pagamento.");
      setPaymentFeedback({
        status: "error",
        message: e?.message || "Erro ao finalizar pagamento.",
      });
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
  const servicosDocumentos = useMemo(
    () => servicosDisponiveis.filter(isDocumentoServico),
    [servicosDisponiveis]
  );
  const servicosGerais = useMemo(
    () => servicosDisponiveis.filter((s) => !isDocumentoServico(s)),
    [servicosDisponiveis]
  );

  const handleEmitDocumento = async (
    servico: Servico,
    options?: { openInNewTab?: boolean }
  ): Promise<string | null> => {
    if (!alunoSelecionado?.id) {
      toast.error("Aluno não selecionado.");
      return null;
    }
    const tipo = getDocumentoTipo(servico);
    if (!tipo) {
      toast.error("Tipo de documento não identificado.");
      return null;
    }

    const shouldOpenNewTab = Boolean(options?.openInNewTab);
    const popup = shouldOpenNewTab ? window.open("", "_blank", "noopener,noreferrer") : null;
    setEmittingDocId(servico.id);
    try {
      const response = await fetch("/api/secretaria/documentos/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alunoId: alunoSelecionado.id,
          tipoDocumento: tipo,
          escolaId,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok || !json?.docId) {
        throw new Error(json?.error || "Falha ao emitir documento");
      }
      const destino = getDocumentoDestino(json.docId, tipo);
      if (shouldOpenNewTab) {
        if (popup) {
          popup.location.href = destino;
        } else {
          window.location.href = destino;
        }
      } else {
        window.location.href = destino;
      }
      return destino;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao emitir documento";
      if (popup) {
        popup.close();
      }
      toast.error(message);
      return null;
    } finally {
      setEmittingDocId(null);
    }
  };

  const handleAdicionarServico = async (servico: Servico) => {
    if (!alunoSelecionado?.id) {
      toast.error("Aluno não selecionado.");
      return;
    }

    setAddingServicoId(servico.id);
    try {
      const { data, error } = await supabase.rpc("balcao_criar_pedido_e_decidir", {
        p_servico_codigo: servico.codigo,
        p_aluno_id: alunoSelecionado.id,
        p_contexto: {},
      });

      if (error || !data) {
        throw new Error(error?.message || "Erro ao criar pedido.");
      }

      const decision = { ...data, servico_codigo: servico.codigo } as BalcaoDecision;
      if (decision.decision === "BLOCKED") {
        setBloqueioInfo({
          code: decision.reason_code,
          detail: decision.reason_detail ?? undefined,
        });
        return;
      }

      const documentoTipo = getDocumentoTipo(servico);
      if (decision.decision === "GRANTED") {
        if (documentoTipo) {
          adicionarAoCarrinho({
            ...servico,
            preco: 0,
            documento_tipo: documentoTipo,
            pedido_id: decision.pedido_id,
          });
          toast.success("Documento liberado. Pode imprimir.");
        } else {
          toast.success("Serviço liberado.");
        }
        if (alunoSelecionado?.id) {
          void fetchAuditFeed(alunoSelecionado.id, alunoSelecionado.matricula_id);
        }
        return;
      }

      adicionarAoCarrinho({
        ...servico,
        preco: decision.amounts?.total ?? servico.preco,
        documento_tipo: documentoTipo,
        pedido_id: decision.pedido_id,
        pagamento_intent_id: decision.payment_intent_id,
      });
      toast.success("Item adicionado ao carrinho.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao adicionar serviço";
      toast.error(message);
    } finally {
      setAddingServicoId(null);
    }
  };

  const handleServicoDecision = useCallback((decision: BalcaoDecision) => {
    if (decision.decision === "GRANTED") {
      const servico = servicosDisponiveis.find((item) => item.codigo === decision.servico_codigo);
      const documentoTipo = servico ? getDocumentoTipo(servico) : null;
      if (servico && documentoTipo) {
        adicionarAoCarrinho({
          ...servico,
          preco: 0,
          documento_tipo: documentoTipo,
          pedido_id: decision.pedido_id,
        });
        toast.success("Documento liberado. Pode imprimir.");
      } else {
        toast.success("Serviço liberado.");
      }
      if (alunoSelecionado?.id) {
        void fetchAuditFeed(alunoSelecionado.id, alunoSelecionado.matricula_id);
      }
      return;
    }

    if (decision.decision === "BLOCKED") {
      setBloqueioInfo({
        code: decision.reason_code,
        detail: decision.reason_detail ?? undefined,
      });
      if (alunoSelecionado?.id) {
        void fetchAuditFeed(alunoSelecionado.id, alunoSelecionado.matricula_id);
      }
      return;
    }

    const servico = servicosDisponiveis.find((item) => item.codigo === decision.servico_codigo);
    if (!servico) {
      toast.error("Serviço não encontrado.");
      return;
    }
    adicionarAoCarrinho({
      ...servico,
      preco: decision.amounts.total ?? servico.preco,
      documento_tipo: getDocumentoTipo(servico),
      pedido_id: decision.pedido_id,
      pagamento_intent_id: decision.payment_intent_id,
    });
    toast.success("Item adicionado ao carrinho.");
  }, [alunoSelecionado, fetchAuditFeed, servicosDisponiveis]);

  useEffect(() => {
    if (!alunoSelecionado?.id) {
      setAuditFeed([]);
      return;
    }
    void fetchAuditFeed(alunoSelecionado.id, alunoSelecionado.matricula_id);
  }, [alunoSelecionado?.id, alunoSelecionado?.matricula_id, fetchAuditFeed, auditScope]);

  // --- UI ---
  return (
    <>
      <div className={embedded ? "bg-transparent" : "min-h-screen bg-slate-50"}>
        <div className={embedded ? "px-0 py-0" : "mx-auto max-w-screen-2xl px-6 py-6"}>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* LEFT: Busca e Catálogo */}
            <div className="xl:col-span-8 space-y-6">
              
              {/* SEARCH CARD */}
              {showSearch ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                        <Search className="h-5 w-5 text-slate-400" />
                      </div>

                      <div className="flex-1">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                          Buscar Aluno
                        </div>
                        <input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Nome, BI, Nº Processo..."
                          className="w-full text-base font-medium text-slate-900 placeholder:text-slate-300 outline-none bg-transparent"
                        />
                      </div>

                      {isSearching ? <Loader2 className="h-5 w-5 animate-spin text-[#E3B23C]" /> : null}
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm("");
                            setAlunosEncontrados([]);
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <X className="h-5 w-5 text-slate-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* RESULTS DROPDOWN */}
                  {normalizeQuery(searchTerm) && (
                    <div className="border-t border-slate-100 max-h-80 overflow-y-auto">
                      {alunosEncontrados.length === 0 && !isSearching ? (
                        <div className="p-6 text-center text-sm text-slate-400">Nenhum aluno encontrado.</div>
                      ) : (
                        alunosEncontrados.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setSearchTerm("");
                              setAlunosEncontrados([]);
                              loadAlunoDossier(a.id);
                            }}
                            className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-slate-50 transition border-b border-slate-50 last:border-b-0 group"
                          >
                            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                              {a.foto_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.foto_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{a.nome}</div>
                              <div className="text-xs text-slate-400 group-hover:text-slate-500">
                                {a.turma} • Proc: {a.numero_processo}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#E3B23C]" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {/* ALUNO + CATÁLOGO */}
              {alunoDossierLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-[#E3B23C]" />
                  <p className="text-sm font-medium text-slate-500">Carregando ficha do aluno...</p>
                </div>
              ) : alunoSelecionado ? (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  
                  {/* CARD DO ALUNO (Perfil) */}
                  <div className="xl:col-span-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden">
                          {alunoSelecionado.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={alunoSelecionado.foto_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <User className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base font-bold text-slate-900 break-words leading-tight mb-1">
                            {alunoSelecionado.nome}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Turma {alunoSelecionado.turma_codigo || alunoSelecionado.turma}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Curso {alunoSelecionado.curso_codigo || alunoSelecionado.curso || "—"}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Classe {alunoSelecionado.classe || "—"}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Processo {alunoSelecionado.numero_processo}
                            </span>
                            <StatusPill status={alunoSelecionado.status_financeiro} />
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Resumo rápido do aluno e situação atual.
                          </p>
                        </div>
                      </div>

                      {alunoSelecionado.status_financeiro === "inadimplente" ? (
                        // CORREÇÃO 2: Dívida em Vermelho Padrão (Sem Rose)
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
                          <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase mb-1">
                            <AlertCircle className="h-4 w-4" />
                            Dívida Acumulada
                          </div>
                          <div className="text-2xl font-black text-red-800">
                            {kwanza.format(alunoSelecionado.divida_total)}
                          </div>
                        </div>
                      ) : (
                        // CORREÇÃO 3: Sucesso em Verde Brand
                        <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/10 p-4 mb-4 flex items-center gap-3">
                          <div className="p-2 bg-[#1F6B3B]/10 rounded-full text-[#1F6B3B]">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase text-[#1F6B3B]">Situação Regular</p>
                            <p className="text-[10px] text-[#1F6B3B]/80">Nenhuma pendência crítica.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CATÁLOGO DE SERVIÇOS */}
                  <div className="xl:col-span-7 rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-[#E3B23C]" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Adicionar Item</h3>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Mensalidades e serviços (inclui documentos pagos)
                      </span>
                      <button
                        onClick={() => {
                          setServicoModalCodigo(null);
                          setServicoModalOpen(true);
                        }}
                        className="text-[10px] font-bold text-[#E3B23C] hover:underline"
                      >
                        + Serviço Avulso
                      </button>
                    </div>

                    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      
                      {/* CORREÇÃO 4: Dívidas em Vermelho Padrão */}
                      {pendenciasAtrasadas.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-red-500 mb-2 pl-1">Em Atraso</p>
                          <div className="grid gap-2">
                            {pendenciasAtrasadas.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => adicionarAoCarrinho(m)}
                                className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50 hover:border-red-300 transition-all text-left group"
                              >
                                <div>
                                  <p className="text-sm font-bold text-red-900 group-hover:text-red-950">{m.nome}</p>
                                  <p className="text-[10px] text-red-600">Vencida</p>
                                </div>
                                <span className="text-sm font-black text-red-800">{kwanza.format(m.preco)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mensalidades */}
                      {pendenciasEmDia.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 pl-1">Mensalidades</p>
                          <div className="grid gap-2">
                            {pendenciasEmDia.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => adicionarAoCarrinho(m)}
                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-[#E3B23C] transition-all text-left group"
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{m.nome}</p>
                                  <p className="text-[10px] text-slate-400">Corrente</p>
                                </div>
                                <span className="text-sm font-bold text-slate-900">{kwanza.format(m.preco)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documentos */}
                      {servicosDocumentos.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 pl-1">Documentos</p>
                          <div className="grid grid-cols-2 gap-2">
                            {servicosDocumentos.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => void handleAdicionarServico(s)}
                                disabled={addingServicoId === s.id}
                                className={cx(
                                  "p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#E3B23C] transition-all text-left",
                                  (addingServicoId === s.id || emittingDocId === s.id) &&
                                    "opacity-60 cursor-not-allowed"
                                )}
                              >
                                <p className="text-xs font-bold text-slate-700 truncate">{s.nome}</p>
                                <div className="mt-1 flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-500">{kwanza.format(s.preco)}</span>
                                  <span
                                    className={
                                      s.preco > 0
                                        ? "text-[10px] font-semibold text-amber-700"
                                        : "text-[10px] font-semibold text-emerald-700"
                                    }
                                  >
                                    {addingServicoId === s.id
                                      ? "Adicionando..."
                                      : s.preco > 0
                                      ? "Cobrar"
                                      : "Adicionar"}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Serviços */}
                      {servicosGerais.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 pl-1">Serviços Extras</p>
                          <div className="grid grid-cols-2 gap-2">
                            {servicosGerais.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => void handleAdicionarServico(s)}
                                disabled={addingServicoId === s.id}
                                className={cx(
                                  "p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#E3B23C] transition-all text-left",
                                  addingServicoId === s.id && "opacity-60 cursor-not-allowed"
                                )}
                              >
                                <p className="text-xs font-bold text-slate-700 truncate">{s.nome}</p>
                                <div className="mt-1 flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-500">{kwanza.format(s.preco)}</span>
                                  <span
                                    className={
                                      s.preco > 0
                                        ? "text-[10px] font-semibold text-amber-700"
                                        : "text-[10px] font-semibold text-emerald-700"
                                    }
                                  >
                                    {s.preco > 0 ? "Pago" : "Grátis"}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Balcão de Atendimento</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">
                    Pesquise um aluno acima para iniciar o atendimento, vender serviços ou regularizar mensalidades.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Carrinho & Checkout */}
            <div className="xl:col-span-4 space-y-6">
              
              {/* STATUS DE PAGAMENTO (TOAST INLINE) */}
              {paymentFeedback && (
                <div className={cx(
                  "p-4 rounded-xl border flex items-start gap-3 animate-in slide-in-from-top-2",
                  paymentFeedback.status === "success" 
                    ? "bg-[#1F6B3B]/10 border-[#1F6B3B]/20 text-[#1F6B3B]" // CORREÇÃO 5: Sucesso Verde Brand
                    : "bg-red-50 border-red-200 text-red-800" // CORREÇÃO 6: Erro Vermelho Padrão
                )}>
                  {paymentFeedback.status === "success" ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                  <div className="flex-1 text-sm font-medium">{paymentFeedback.message}</div>
                  <button onClick={() => setPaymentFeedback(null)}><X className="h-4 w-4 opacity-50 hover:opacity-100" /></button>
                </div>
              )}

              {printQueue.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold text-emerald-800 mb-2">
                    Documentos prontos para impressão
                  </div>
                  <div className="space-y-2">
                    {printQueue.map((doc, index) => (
                      <button
                        key={`${doc.url}-${index}`}
                        type="button"
                        onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}
                        className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Abrir {doc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CARD DO CARRINHO */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-6">
                
                {/* Header Carrinho */}
                <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-[#E3B23C]" />
                    <span className="font-bold text-sm">Resumo da Venda</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAuditOpen((prev) => !prev);
                        if (!auditOpen) {
                          fetchAuditFeed(alunoSelecionado?.id, alunoSelecionado?.matricula_id);
                        }
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition"
                    >
                      {auditOpen ? "Fechar audit" : "Audit trail"}
                    </button>
                    {carrinho.length > 0 && (
                      <button
                        onClick={limparCarrinho}
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {auditOpen ? (
                  <div className="border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between px-6 py-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">
                        {auditScope === "aluno" ? "Somente aluno" : "Todos"}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAuditScope(auditScope === "aluno" ? "todos" : "aluno")}
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
                        >
                          {auditScope === "aluno" ? "Ver todos" : "Ver aluno"}
                        </button>
                        <button
                          type="button"
                          onClick={() => fetchAuditFeed(alunoSelecionado?.id, alunoSelecionado?.matricula_id)}
                          className="text-[10px] font-bold uppercase tracking-wider text-klasse-gold"
                        >
                          Atualizar
                        </button>
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto px-6 pb-4">
                      {!alunoSelecionado ? (
                        <div className="text-xs text-slate-500">Selecione um aluno para ver o histórico.</div>
                      ) : auditLoading ? (
                        <div className="space-y-3">
                          <SkeletonLine />
                          <SkeletonLine />
                        </div>
                      ) : auditFeed.length === 0 ? (
                        <div className="text-xs text-slate-500">Sem registros recentes.</div>
                      ) : (
                        <div className="space-y-3">
                          {auditFeed.map((entry, index) => {
                            const createdAt = entry.created_at
                              ? new Date(entry.created_at).toLocaleString("pt-PT", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—";
                            return (
                              <div key={`${entry.created_at}-${index}`} className="rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-slate-900">
                                    {entry.action || "Evento"}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{createdAt}</div>
                                </div>
                                <div className="mt-1 text-xs text-slate-600">
                                  {entry.entity ? `Entidade: ${entry.entity}` : ""}
                                  {entry.portal ? ` • ${entry.portal}` : ""}
                                </div>
                                {entry.details ? (
                                  <div className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                                    {JSON.stringify(entry.details)}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Lista de Itens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {carrinho.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                      <ShoppingCart className="h-10 w-10 opacity-20" />
                      <span className="text-xs font-medium">O carrinho está vazio</span>
                    </div>
                  ) : (
                    carrinho.map((item) => {
                      const isDocumento = item.tipo === "servico" && "documento_tipo" in item;
                      const podeImprimir =
                        isDocumento && Number(item.preco ?? 0) <= 0 && (item as Servico).documento_tipo;

                      return (
                        <div key={`${item.id}-${item.tipo}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start gap-3 group">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 leading-tight">{item.nome}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">{item.tipo}</p>
                            {podeImprimir ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const url = await handleEmitDocumento(item as Servico, { openInNewTab: true });
                                  if (url) {
                                    setPrintQueue((prev) => [{ label: item.nome, url }, ...prev]);
                                  }
                                }}
                                className="mt-2 text-[10px] font-semibold text-emerald-700 hover:underline"
                              >
                                Imprimir agora
                              </button>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">{kwanza.format(item.preco)}</p>
                            <button 
                              onClick={() => removerDoCarrinho(item.id, item.tipo)}
                              className="text-[10px] text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline mt-1"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer de Pagamento */}
                <div className="bg-white border-t border-slate-200 p-6 shrink-0 space-y-5">
                  
                  {/* Totalizador */}
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total a Pagar</span>
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{kwanza.format(total)}</span>
                  </div>

                  {/* Seletor de Método */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: "cash", icon: Banknote, label: "Cash" },
                      { id: "tpa", icon: CreditCard, label: "TPA" },
                      { id: "transfer", icon: Wallet, label: "Transf" },
                      { id: "mcx", icon: Smartphone, label: "MCX" },
                      { id: "kiwk", icon: Smartphone, label: "KIWK" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMetodo(m.id as MetodoPagamento)}
                        className={cx(
                          "flex flex-col items-center justify-center py-3 rounded-xl border transition-all gap-1",
                          metodo === m.id
                            ? "border-[#E3B23C] bg-[#E3B23C]/5 text-slate-900"
                            : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                        )}
                      >
                        <m.icon className={cx("h-5 w-5", metodo === m.id ? "text-[#E3B23C]" : "text-current")} />
                        <span className="text-[10px] font-bold uppercase">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {(metodo === "tpa" || metodo === "mcx" || metodo === "kiwk") && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        {metodo === "tpa" ? "Referência obrigatória" : "Referência (opcional)"}
                      </label>
                      <input
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder={metodo === "tpa" ? "TPA-2026-000882" : "Opcional"}
                        className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C]"
                      />
                      {(metodo === "mcx" || metodo === "kiwk") && (
                        <input
                          value={paymentGatewayRef}
                          onChange={(e) => setPaymentGatewayRef(e.target.value)}
                          placeholder={metodo === "kiwk" ? "KIWK ref (opcional)" : "Gateway ref (opcional)"}
                          className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C]"
                        />
                      )}
                    </div>
                  )}

                  {metodo === "transfer" && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Comprovativo obrigatório (URL)
                      </label>
                      <input
                        value={paymentEvidenceUrl}
                        onChange={(e) => setPaymentEvidenceUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C]"
                      />
                    </div>
                  )}

                  {/* Input de Valor (Só para Dinheiro) */}
                  {metodo === "cash" && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Recebido</label>
                        {valorRecebidoNum > total && (
                          // CORREÇÃO 7: Troco em Verde Brand
                          <span className="text-xs font-bold text-[#1F6B3B]">Troco: {kwanza.format(troco)}</span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={valorRecebido}
                          onChange={(e) => setValorRecebido(e.target.value)}
                          placeholder="0"
                          className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-lg font-bold text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">KZ</span>
                      </div>
                    </div>
                  )}

                  {/* Botão Final */}
                  <button
                    disabled={!prontoParaFechar || isSubmitting}
                    onClick={handleCheckout}
                    className={cx(
                      "w-full py-4 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2",
                      prontoParaFechar && !isSubmitting
                        ? "bg-[#E3B23C] text-white shadow-orange-900/10 hover:brightness-105 hover:-translate-y-0.5"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Printer className="h-5 w-5" />
                    )}
                    {isSubmitting
                      ? "Processando..."
                      : total === 0
                      ? "Emitir documentos"
                      : "Finalizar & Imprimir"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* MODAIS (MANTIDOS) */}
      <BalcaoServicoModal
        open={servicoModalOpen}
        onClose={() => setServicoModalOpen(false)}
        alunoId={alunoSelecionado?.id ?? null}
        servicos={servicosDisponiveis}
        initialCodigo={servicoModalCodigo}
        onDecision={(decision) => {
          setServicoModalOpen(false);
          handleServicoDecision(decision);
        }}
      />
      <MotivoBloqueioModal
        open={!!bloqueioInfo}
        onClose={() => setBloqueioInfo(null)}
        reasonCode={bloqueioInfo?.code ?? ""}
        reasonDetail={bloqueioInfo?.detail ?? null}
      />
    </>
  );
}
