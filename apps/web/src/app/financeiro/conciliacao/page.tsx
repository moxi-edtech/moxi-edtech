"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";
import { toast } from "sonner";
import {
  Upload,
  FileUp,
  Landmark,
  CheckCircle,
  XCircle,
  Search,
  BarChart3,
  Settings,
  Trash2,
  Check,
  AlertTriangle,
  Eye,
  Loader2,
  CalendarCheck,
  Wallet,
  Filter,
  FileText,
} from "lucide-react";

// -----------------------------
// Types
// -----------------------------
interface TransacaoBancaria {
  id: string;
  data: Date;
  descricao: string;
  referencia: string;
  valor: number;
  tipo: "credito" | "debito";
  banco: string;
  conta: string;
  status: "pendente" | "conciliado" | "ignorado";
  alunoMatch?: {
    id: string;
    nome: string;
    turma: string;
    mensalidadesPendentes: Array<{
      id: string;
      mes: number;
      ano: number;
      valor: number;
    }>;
  };
  matchConfianca: number; // 0-100
}

interface MatchSugerido {
  transacaoId: string;
  alunoId: string;
  mensalidadeId?: string;
  confianca: number;
  razao: string;
}

// -----------------------------
// Helpers (KLASSE vibe)
// -----------------------------
const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const kwanza = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });

const formatKz = (v: number) => `${Math.round(v).toLocaleString("pt-AO")} Kz`;

const safeDate = (d: Date) => (Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-AO"));

const clampPercent = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function toneByConfidence(n: number): "high" | "mid" | "low" {
  if (n >= 90) return "high";
  if (n >= 70) return "mid";
  return "low";
}

function toneByStatus(s: TransacaoBancaria["status"]): "ok" | "warn" | "neutral" {
  if (s === "conciliado") return "ok";
  if (s === "pendente") return "warn";
  return "neutral";
}

function pillClasses(tone: "ok" | "warn" | "neutral") {
  return cx(
    "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
    tone === "ok" && "border-klasse-green/25 bg-klasse-green/10 text-klasse-green",
    tone === "warn" && "border-klasse-gold/25 bg-klasse-gold/10 text-klasse-gold",
    tone === "neutral" && "border-slate-200 bg-white text-slate-700"
  );
}

function iconBadge(tone: "ok" | "warn" | "neutral") {
  return cx(
    "inline-flex h-10 w-10 items-center justify-center rounded-2xl border",
    tone === "ok" && "border-klasse-green/25 bg-klasse-green/10",
    tone === "warn" && "border-klasse-gold/25 bg-klasse-gold/10",
    tone === "neutral" && "border-slate-200 bg-slate-100"
  );
}

function iconColor(tone: "ok" | "warn" | "neutral") {
  return cx(
    "h-5 w-5",
    tone === "ok" && "text-klasse-green",
    tone === "warn" && "text-klasse-gold",
    tone === "neutral" && "text-slate-700"
  );
}

function confidenceBar(n: number) {
  const p = clampPercent(n);
  const t = toneByConfidence(p);

  // no hard colors — just KLASSE gold/green + slate
  const bar = cx(
    "h-1.5 rounded-full",
    t === "high" && "bg-klasse-green/70",
    t === "mid" && "bg-klasse-gold/70",
    t === "low" && "bg-slate-300"
  );

  return (
    <div className="min-w-[140px]">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>Confiança</span>
        <span className="font-semibold text-slate-700">{p}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
        <div className={bar} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

// -----------------------------
// UI atoms
// -----------------------------
function SectionHeader(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
      <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-slate-100 border border-slate-200">
          <Icon className="h-4 w-4 text-slate-600" />
        </span>
        {props.title}
      </h2>
      {props.action}
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "ok" | "warn" | "neutral";
  hint?: string;
}) {
  const Icon = props.icon;
  const tone = props.tone ?? "neutral";

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            {props.title}
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900 truncate">{props.value}</div>
          {props.hint ? <div className="mt-1 text-xs text-slate-500">{props.hint}</div> : null}
        </div>
        <span className={iconBadge(tone)}>
          <Icon className={iconColor(tone)} />
        </span>
      </div>
    </div>
  );
}

function SoftButton(props: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const Icon = props.icon;
  const variant = props.variant ?? "secondary";

  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
        "focus:outline-none focus:ring-4 focus:ring-klasse-gold/20",
        props.disabled && "opacity-60 cursor-not-allowed",
        variant === "primary" && "bg-klasse-gold text-white hover:brightness-95",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100"
      )}
    >
      <Icon className={cx("h-4 w-4", variant !== "primary" && "text-slate-600")} />
      {props.children}
    </button>
  );
}

function SelectPill(props: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <Filter className="h-4 w-4 text-slate-500" />
      <select
        className="bg-transparent text-sm font-medium text-slate-900 outline-none"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// -----------------------------
// Page
// -----------------------------
const ConciliacaoBancaria: React.FC = () => {
  const [transacoes, setTransacoes] = useState<TransacaoBancaria[]>([]);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("BAI");
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("pendente");
  const [matchSugestoes, setMatchSugestoes] = useState<MatchSugerido[]>([]);
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);

  const [processingUpload, setProcessingUpload] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [configMatching, setConfigMatching] = useState({
    toleranciaValor: 100,
    diasToleranciaVencimento: 5,
    usarNomeSimilar: true,
    confiancaMinima: 70,
    autoConciliarAltaConfianca: true,
  });

  // -------- Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      const qs = new URLSearchParams();
      // mantém compat com teu endpoint atual
      qs.set("status", filtroStatus);

      const response = await fetch(`/api/financeiro/conciliacao/transacoes?${qs.toString()}`);
      const result = await response.json();

      if (response.ok && result.ok && Array.isArray(result.transactions)) {
        const parsed = result.transactions.map((t: any) => ({
          ...t,
          data: new Date(t.data),
          alunoMatch: t.alunoMatch ? t.alunoMatch : undefined,
        }));
        setTransacoes(parsed);
      } else {
        toast.error(result.error || "Erro ao carregar transações.");
        setTransacoes([]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão ao carregar transações.");
      setTransacoes([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // -------- Upload
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        toast.error("Selecione um arquivo.");
        return;
      }
      if (!bancoSelecionado) {
        toast.error("Selecione o banco.");
        return;
      }

      setProcessingUpload(true);

      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("banco", bancoSelecionado);
      if (contaSelecionada) formData.append("conta", contaSelecionada);

      try {
        const response = await fetch("/api/financeiro/conciliacao/upload", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();

        if (response.ok && result.ok) {
          toast.success("Extrato importado com sucesso!");
          setArquivos([file]);
          fetchTransactions();
        } else {
          toast.error(result.error || "Erro ao importar extrato.");
          setArquivos([]);
        }
      } catch (e) {
        console.error(e);
        toast.error("Erro de conexão ou servidor.");
        setArquivos([]);
      } finally {
        setProcessingUpload(false);
      }
    },
    [bancoSelecionado, contaSelecionada, fetchTransactions]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    multiple: false,
  });

  // -------- Actions
  const processarMatchingAutomatico = () => {
    const sugestoes: MatchSugerido[] = transacoes
      .filter((t) => t.status === "pendente")
      .map((t) => ({
        transacaoId: t.id,
        alunoId: "1",
        confianca: t.matchConfianca,
        razao: t.referencia ? "referencia_exata" : "valor_similar",
      }));

    setMatchSugestoes(sugestoes);

    if (configMatching.autoConciliarAltaConfianca) {
      setTransacoes((prev) =>
        prev.map((t) =>
          t.status === "pendente" && t.matchConfianca >= configMatching.confiancaMinima
            ? { ...t, status: "conciliado" as const }
            : t
        )
      );
    }

    toast.success("Matching processado. Revise as sugestões antes de confirmar.");
  };

  const conciliarTransacao = async (transacaoId: string, alunoId: string, mensalidadeId?: string) => {
    setProcessingUpload(true);
    try {
      const response = await fetch("/api/financeiro/conciliacao/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transacao_id: transacaoId,
          aluno_id: alunoId,
          mensalidade_id: mensalidadeId ?? null,
          settle_meta: { origem: "conciliacao_ui" },
        }),
      });

      const result = await response.json();
      if (response.ok && result.ok) {
        toast.success("Transação conciliada e pagamento liquidado!");
        fetchTransactions();
      } else {
        toast.error(result.error || "Erro ao conciliar transação.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão/servidor ao conciliar.");
    } finally {
      setProcessingUpload(false);
    }
  };

  const ignorarTransacao = (transacaoId: string) => {
    setTransacoes((prev) => prev.map((t) => (t.id === transacaoId ? { ...t, status: "ignorado" } : t)));
    toast.message("Transação marcada como ignorada.");
  };

  const resumo = useMemo(() => {
    const pendentes = transacoes.filter((t) => t.status === "pendente");
    const conciliados = transacoes.filter((t) => t.status === "conciliado");
    const ignorados = transacoes.filter((t) => t.status === "ignorado");

    return {
      total: transacoes.length,
      pendentes: pendentes.length,
      conciliados: conciliados.length,
      ignorados: ignorados.length,
      valorPendente: pendentes.reduce((sum, t) => sum + t.valor, 0),
      valorConciliado: conciliados.reduce((sum, t) => sum + t.valor, 0),
    };
  }, [transacoes]);

  const hasPendentes = useMemo(() => transacoes.some((t) => t.status === "pendente"), [transacoes]);

  // -------- Render
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="p-4 md:p-10">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Top header */}
          <header className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="h-1 bg-gradient-to-r from-transparent via-klasse-gold/60 to-transparent" />
            <div className="px-6 py-6 md:px-8 md:py-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    Conciliação Bancária
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Importa extratos, sugere matches e registra pagamentos com rastreabilidade.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <SoftButton
                    icon={Search}
                    variant="primary"
                    onClick={processarMatchingAutomatico}
                    disabled={!hasPendentes || processingUpload || loadingTransactions}
                  >
                    Matching automático
                  </SoftButton>

                  <SoftButton icon={BarChart3} variant="secondary" onClick={() => toast.message("TODO: relatório")}>
                    Relatório
                  </SoftButton>

                  <SelectPill
                    value={filtroStatus}
                    onChange={setFiltroStatus}
                    options={[
                      { value: "todos", label: "Todos" },
                      { value: "pendente", label: "Pendentes" },
                      { value: "conciliado", label: "Conciliados" },
                      { value: "ignorado", label: "Ignorados" },
                    ]}
                  />
                </div>
              </div>
            </div>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard title="Transações" value={resumo.total} icon={FileUp} tone="neutral" hint="No filtro atual" />
            <StatCard title="Pendentes" value={resumo.pendentes} icon={CalendarCheck} tone="warn" hint="Revisar" />
            <StatCard title="Conciliados" value={resumo.conciliados} icon={CheckCircle} tone="ok" hint="Confirmados" />
            <StatCard
              title="Valor pendente"
              value={formatKz(resumo.valorPendente)}
              icon={Wallet}
              tone={resumo.valorPendente > 0 ? "warn" : "neutral"}
              hint="Somatório"
            />
          </div>

          {/* Upload + settings */}
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
            <SectionHeader
              icon={Landmark}
              title="Importar extrato bancário"
              action={
                <button
                  onClick={() => setMostrarConfiguracoes((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                >
                  <Settings className="h-4 w-4 text-slate-600" />
                  Configurar matching
                </button>
              }
            />

            {mostrarConfiguracoes ? (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Motor de matching</div>
                    <p className="mt-1 text-xs text-slate-600">
                      Ajuste a agressividade. Menos risco = mais trabalho manual.
                    </p>
                  </div>
                  <span className={pillClasses("neutral")}>Config</span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Tolerância de valor (Kz)</span>
                    <input
                      type="number"
                      value={configMatching.toleranciaValor}
                      onChange={(e) =>
                        setConfigMatching((p) => ({ ...p, toleranciaValor: Number(e.target.value || 0) }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Dias tolerância (vencimento)</span>
                    <input
                      type="number"
                      value={configMatching.diasToleranciaVencimento}
                      onChange={(e) =>
                        setConfigMatching((p) => ({
                          ...p,
                          diasToleranciaVencimento: Number(e.target.value || 0),
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Confiança mínima (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={configMatching.confiancaMinima}
                      onChange={(e) =>
                        setConfigMatching((p) => ({ ...p, confiancaMinima: Number(e.target.value || 0) }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <input
                      type="checkbox"
                      checked={configMatching.usarNomeSimilar}
                      onChange={(e) =>
                        setConfigMatching((p) => ({ ...p, usarNomeSimilar: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Usar matching por nome</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <input
                      type="checkbox"
                      checked={configMatching.autoConciliarAltaConfianca}
                      onChange={(e) =>
                        setConfigMatching((p) => ({
                          ...p,
                          autoConciliarAltaConfianca: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Auto-conciliar alta confiança</span>
                  </label>
                </div>
              </div>
            ) : null}

            {/* Bank select */}
            <div className="mb-4">
              <div className="text-sm font-medium text-slate-700">Banco</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {["BAI", "BFA", "BIC", "MBWay", "Multicaixa", "Outro"].map((banco) => {
                  const active = bancoSelecionado === banco;
                  return (
                    <button
                      key={banco}
                      onClick={() => setBancoSelecionado(banco)}
                      className={cx(
                        "rounded-xl px-4 py-2 text-sm font-medium transition border",
                        active
                          ? "border-klasse-gold/30 bg-klasse-gold/10 text-slate-900"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {banco}
                    </button>
                  );
                })}
              </div>

              {bancoSelecionado !== "MBWay" ? (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Conta bancária <span className="text-slate-400">(opcional)</span>
                  </label>
                  <input
                    value={contaSelecionada}
                    onChange={(e) => setContaSelecionada(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    placeholder="Número da conta"
                  />
                </div>
              ) : null}
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cx(
                "rounded-2xl border-2 border-dashed p-8 text-center transition cursor-pointer",
                isDragActive
                  ? "border-klasse-gold/60 bg-klasse-gold/10"
                  : "border-slate-300 hover:border-slate-400"
              )}
            >
              <input {...getInputProps()} />
              {processingUpload ? (
                <Loader2 className="mx-auto mb-3 h-12 w-12 animate-spin text-slate-400" />
              ) : (
                <Upload className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              )}
              <p className="text-lg font-semibold text-slate-900">
                {isDragActive ? "Solte o arquivo aqui" : "Arraste ou clique para selecionar"}
              </p>
              <p className="mt-1 text-sm text-slate-600">CSV, XLS, XLSX</p>

              <div className="mt-4">
                <button
                  disabled={processingUpload}
                  className="inline-flex items-center justify-center rounded-xl bg-klasse-gold px-6 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
                >
                  {processingUpload ? "Processando..." : "Selecionar arquivo"}
                </button>
              </div>
            </div>

            {/* Processed file */}
            {arquivos.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-medium text-slate-700">Arquivo processado</div>
                <div className="mt-2 space-y-2">
                  {arquivos.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileUp className="h-5 w-5 text-slate-600" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{file.name}</div>
                          <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setArquivos([]);
                          setTransacoes([]);
                        }}
                        className="rounded-xl p-2 text-slate-500 hover:text-red-600 hover:bg-white focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                        title="Remover"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!processingUpload && transacoes.length === 0 && arquivos.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-klasse-gold/25 bg-klasse-gold/10 p-4 text-slate-900">
                <div className="flex items-start gap-3">
                  <span className={iconBadge("warn")}>
                    <AlertTriangle className={iconColor("warn")} />
                  </span>
                  <div>
                    <div className="font-semibold">Nenhuma transação válida encontrada.</div>
                    <div className="mt-1 text-sm text-slate-700">
                      Verifique o formato do arquivo e/ou ajuste as configurações de matching.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* Table */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="px-6 py-5">
              <SectionHeader
                icon={FileText}
                title="Transações"
                action={
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <Search className="h-4 w-4 text-slate-500" />
                    <span className="font-medium">Revisão</span>
                    <span className={pillClasses("neutral")}>{matchSugestoes.length} sugestões</span>
                  </div>
                }
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Referência
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Banco
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Match
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-slate-200">
                  {loadingTransactions ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
                        Carregando transações...
                      </td>
                    </tr>
                  ) : transacoes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                        Nenhuma transação encontrada.
                      </td>
                    </tr>
                  ) : (
                    transacoes
                      .filter((t) => filtroStatus === "todos" || t.status === filtroStatus)
                      .map((t) => {
                        const statusTone = toneByStatus(t.status);
                        const isCredito = t.tipo === "credito";

                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              <div className="text-sm font-medium text-slate-900">{safeDate(t.data)}</div>
                            </td>

                            <td className="px-6 py-4 align-top">
                              <div className="text-sm font-semibold text-slate-900">{t.descricao}</div>
                              <div className="mt-1 text-xs text-slate-500 truncate">{t.conta}</div>
                            </td>

                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              <div className="text-sm text-slate-900">{t.referencia || "—"}</div>
                            </td>

                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              <div
                                className={cx(
                                  "text-sm font-black",
                                  isCredito ? "text-klasse-green" : "text-slate-900"
                                )}
                                title={kwanza.format(t.valor)}
                              >
                                {formatKz(t.valor)}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">
                                {isCredito ? "Crédito" : "Débito"}
                              </div>
                            </td>

                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              <div className="text-sm font-medium text-slate-900">{t.banco}</div>
                            </td>

                            <td className="px-6 py-4 align-top">
                              {t.alunoMatch ? (
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900 truncate">
                                      {t.alunoMatch.nome}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {t.alunoMatch.turma} • {clampPercent(t.matchConfianca)}%
                                    </div>
                                  </div>
                                  {confidenceBar(t.matchConfianca)}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <span className={iconBadge("neutral")}>
                                    <AlertTriangle className={iconColor("neutral")} />
                                  </span>
                                  <span className="font-medium">Sem match</span>
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              <span className={pillClasses(statusTone)}>
                                {t.status === "conciliado"
                                  ? "Conciliado"
                                  : t.status === "pendente"
                                  ? "Pendente"
                                  : "Ignorado"}
                              </span>
                            </td>

                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {t.status === "pendente" && t.alunoMatch ? (
                                  <button
                                    onClick={() =>
                                      conciliarTransacao(
                                        t.id,
                                        t.alunoMatch!.id,
                                        t.alunoMatch!.mensalidadesPendentes?.[0]?.id
                                      )
                                    }
                                    className="rounded-xl p-2 text-klasse-green hover:bg-klasse-green/10 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                                    title="Conciliar"
                                  >
                                    <Check className="h-5 w-5" />
                                  </button>
                                ) : null}

                                {t.status === "pendente" && !t.alunoMatch ? (
                                  <button
                                    onClick={() => toast.message("TODO: modal de busca manual")}
                                    className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                                    title="Buscar aluno"
                                  >
                                    <Search className="h-5 w-5" />
                                  </button>
                                ) : null}

                                <button
                                  onClick={() => ignorarTransacao(t.id)}
                                  className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                                  title="Ignorar"
                                >
                                  <XCircle className="h-5 w-5" />
                                </button>

                                <button
                                  onClick={() => toast.message("TODO: drawer de detalhes")}
                                  className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                                  title="Detalhes"
                                >
                                  <Eye className="h-5 w-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer hint */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-600">
                  Dica: use <span className="font-semibold text-slate-900">Confiança mínima</span> com cuidado.
                  Auto-conciliar errado vira dor no suporte.
                </div>
                <Link
                  href="/financeiro"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Voltar ao Financeiro
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ConciliacaoBancaria;
