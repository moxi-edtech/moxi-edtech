"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Lock,
  Play,
  RefreshCw,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type WizardState = "validando" | "bloqueado" | "pronto" | "rodando" | "falha" | "concluido";
type JobStep = "PENDING" | "CLOSING_PERIOD" | "FINALIZING_ENROLLMENTS" | "GENERATING_HISTORY" | "COMPLETED";

type Pendencia = {
  id: string;
  turma_id?: string;
  mensagem: string;
  severidade: "CRITICAL" | "WARN";
  pode_excecao: boolean;
};

type FechamentoJob = {
  run_id: string;
  estado: string;
  errors?: Array<{ stage?: string; error?: string }>;
  steps?: Array<{ etapa: string; status: string; created_at: string; error_message?: string | null }>;
};

type AnoLetivo = {
  id: string;
  ano?: number | null;
};

type PeriodoLetivo = {
  id: string;
  tipo?: string | null;
  numero?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

type PeriodosResponse = {
  ok?: boolean;
  ano_letivo?: AnoLetivo | null;
  periodos?: PeriodoLetivo[] | null;
  error?: string;
};

const mapEstadoToStep = (estado?: string | null): JobStep => {
  if (!estado) return "PENDING";
  if (estado === "CLOSING_PERIOD") return "CLOSING_PERIOD";
  if (estado === "FINALIZING_ENROLLMENTS") return "FINALIZING_ENROLLMENTS";
  if (estado === "GENERATING_HISTORY") return "GENERATING_HISTORY";
  if (estado === "OPENING_NEXT_PERIOD") return "GENERATING_HISTORY";
  if (estado === "DONE") return "COMPLETED";
  return "PENDING";
};

export default function FechamentoAcademicoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [acao, setAcao] = useState<"fechar_trimestre" | "fechar_ano">("fechar_trimestre");
  const [anoLetivoId, setAnoLetivoId] = useState("");
  const [periodoLetivoId, setPeriodoLetivoId] = useState("");
  const [turmaIds, setTurmaIds] = useState("");
  const [currentState, setCurrentState] = useState<WizardState>("pronto");
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [sanidadeOk, setSanidadeOk] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [currentJobStep, setCurrentJobStep] = useState<JobStep>("PENDING");
  const [erroFatal, setErroFatal] = useState<string | null>(null);
  const [validacaoMensagem, setValidacaoMensagem] = useState<string | null>(null);
  const [prefillDone, setPrefillDone] = useState(false);
  const [autoPrefillDone, setAutoPrefillDone] = useState(false);
  const [autoSanidadeDone, setAutoSanidadeDone] = useState(false);
  const [anoLetivoOptions, setAnoLetivoOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [periodoOptions, setPeriodoOptions] = useState<Array<{ id: string; label: string }>>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  const turmaIdsArray = turmaIds
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  useEffect(() => {
    if (prefillDone) return;
    if (!searchParams) return;
    const acaoParam = searchParams.get("acao");
    const anoParam = searchParams.get("ano_letivo_id");
    const periodoParam = searchParams.get("periodo_letivo_id");
    const turmasParam = searchParams.get("turma_ids");

    if (acaoParam === "fechar_trimestre" || acaoParam === "fechar_ano") {
      setAcao(acaoParam);
    }
    if (anoParam && !anoLetivoId) setAnoLetivoId(anoParam);
    if (periodoParam && !periodoLetivoId) setPeriodoLetivoId(periodoParam);
    if (turmasParam && !turmaIds) setTurmaIds(turmasParam);
    setPrefillDone(true);
  }, [searchParams, anoLetivoId, periodoLetivoId, turmaIds, prefillDone]);

  useEffect(() => {
    if (autoPrefillDone || !escolaParam) return;
    if (anoLetivoId && (acao !== "fechar_trimestre" || periodoLetivoId)) {
      setAutoPrefillDone(true);
      return;
    }

    const carregar = async () => {
      try {
        const res = await fetch(`/api/escola/${escolaParam}/admin/periodos-letivos`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as PeriodosResponse | null;
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar períodos");

        const anoAtivo = json.ano_letivo ?? null;
        const periodos = Array.isArray(json.periodos) ? json.periodos : [];

        if (anoAtivo?.id) {
          const anoLabel = anoAtivo?.ano ? `${anoAtivo.ano}/${Number(anoAtivo.ano) + 1}` : "Ano letivo ativo";
          setAnoLetivoOptions([{ id: anoAtivo.id, label: anoLabel }]);
        }

        setPeriodoOptions(
          periodos.map((periodo) => ({
            id: periodo.id,
            label: periodo.numero
              ? `${periodo.numero}º ${String(periodo.tipo || "Trimestre").toLowerCase()}`
              : periodo.id,
          }))
        );

        if (anoAtivo?.id && !anoLetivoId) {
          setAnoLetivoId(anoAtivo.id);
        }

        const today = new Date();
        const atual = periodos.find((periodo) => {
          const inicio = periodo.data_inicio ? new Date(periodo.data_inicio) : null;
          const fim = periodo.data_fim ? new Date(periodo.data_fim) : null;
          if (!inicio || !fim) return false;
          return today >= inicio && today <= fim;
        });

        if (atual?.id && !periodoLetivoId) {
          setPeriodoLetivoId(atual.id);
        }
        if (atual?.id && acao !== "fechar_trimestre") {
          setAcao("fechar_trimestre");
        }
      } catch (err) {
        setErroFatal(err instanceof Error ? err.message : "Falha ao resolver calendário.");
      } finally {
        setAutoPrefillDone(true);
      }
    };

    void carregar();
  }, [autoPrefillDone, escolaId, anoLetivoId, periodoLetivoId, acao]);

  useEffect(() => {
    if (autoSanidadeDone || !autoPrefillDone) return;
    if (!anoLetivoId || currentState === "rodando") return;
    if (acao === "fechar_trimestre" && !periodoLetivoId) return;
    setAutoSanidadeDone(true);
    void validarSanidade();
  }, [autoSanidadeDone, autoPrefillDone, anoLetivoId, periodoLetivoId, acao, currentState]);

  useEffect(() => {
    if (currentState === "rodando" || currentState === "concluido") return;
    setSanidadeOk(false);
    setPendencias([]);
    setErroFatal(null);
    setValidacaoMensagem(null);
  }, [acao, anoLetivoId, periodoLetivoId, turmaIds, currentState]);

  const validarSanidade = async () => {
    setErroFatal(null);
    setValidacaoMensagem(null);
    if (!anoLetivoId) {
      setValidacaoMensagem("Selecione o ano letivo antes de continuar.");
      return;
    }
    if (acao === "fechar_trimestre" && !periodoLetivoId) {
      setValidacaoMensagem("Selecione o trimestre para continuar.");
      return;
    }

    setCurrentState("validando");
    setSanidadeOk(false);
    setPendencias([]);

    try {
      const params = new URLSearchParams({
        acao,
        ano_letivo_id: anoLetivoId,
      });
      if (periodoLetivoId) params.set("periodo_letivo_id", periodoLetivoId);
      if (turmaIds) params.set("turma_ids", turmaIds);

      const res = await fetch(`/api/secretaria/fechamento-academico/sanidade?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao validar sanidade.");

      const relatorio = json.relatorio;
      const pendenciasRelatorio = (relatorio?.pendencias ?? []) as Pendencia[];
      const critical = pendenciasRelatorio.filter((p) => p.severidade === "CRITICAL");

      if (critical.length > 0) {
        setPendencias(pendenciasRelatorio);
        setCurrentState("bloqueado");
        setSanidadeOk(false);
      } else {
        setCurrentState("pronto");
        setSanidadeOk(true);
      }
    } catch (err) {
      setErroFatal(err instanceof Error ? err.message : "Falha ao comunicar com o servidor.");
      setCurrentState("falha");
    }
  };

  const iniciarFecho = async () => {
    setErroFatal(null);
    setCurrentJobStep("PENDING");

    try {
      const res = await fetch("/api/secretaria/fechamento-academico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao,
          ano_letivo_id: anoLetivoId,
          periodo_letivo_id: periodoLetivoId || undefined,
          turma_ids: turmaIdsArray,
          executar_assincrono: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao iniciar o fecho de período.");

      setRunId(json.run_id);
      setCurrentState("rodando");
    } catch (err) {
      setErroFatal(err instanceof Error ? err.message : "Falha ao iniciar o fecho de período.");
      setCurrentState("falha");
    }
  };

  useEffect(() => {
    if (currentState !== "rodando" || !runId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/secretaria/fechamento-academico?run_id=${runId}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao atualizar execução.");

        const job = (json.jobs ?? [])[0] as FechamentoJob | undefined;
        if (!job) throw new Error("Execução não encontrada.");

        const estado = job.estado;
        if (estado === "FAILED") {
          const firstError = job.errors?.[0]?.error || job.steps?.find((s) => s.error_message)?.error_message;
          setErroFatal(firstError || "Falha durante o fechamento.");
          setCurrentState("falha");
          return;
        }

        if (estado === "DONE") {
          setCurrentJobStep("COMPLETED");
          setCurrentState("concluido");
          return;
        }

        setCurrentJobStep(mapEstadoToStep(estado));
      } catch (err) {
        setErroFatal(err instanceof Error ? err.message : "Falha ao comunicar com o servidor.");
        setCurrentState("falha");
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentState, runId]);

  const titulo = acao === "fechar_ano" ? "Fecho do Ano Letivo" : "Fecho do Trimestre";

  if (currentState === "validando") {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <RefreshCw className="w-10 h-10 text-[#1F6B3B] animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-900 font-sora">A preparar o fecho...</h2>
        <p className="text-slate-500 text-sm mt-2">Estamos a confirmar se está tudo pronto.</p>
      </div>
    );
  }

  if (currentState === "bloqueado") {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
        <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
          <div className="bg-red-100 p-3 rounded-xl text-red-600 flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-900 font-sora">Pendências Críticas Detetadas</h2>
            <p className="text-red-700 text-sm mt-1">
              O fecho está bloqueado. Resolva os pontos abaixo e tente novamente.
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ul className="space-y-3">
            {pendencias.map((p) => (
              <li
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold min-w-[80px]">{p.turma_id ?? "-"}</span>
                  <span className="text-slate-600">{p.mensagem}</span>
                </div>
                <span className="text-xs font-semibold text-red-600">
                  {p.severidade}{p.pode_excecao ? " · Exceção permitida" : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={validarSanidade}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
            >
              Verificar novamente
            </button>
            <Link
              href="/secretaria/fechamento-academico/sanidade"
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold"
            >
              Abrir relatório completo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isClosing =
    currentJobStep === "CLOSING_PERIOD" ||
    currentJobStep === "FINALIZING_ENROLLMENTS" ||
    currentJobStep === "GENERATING_HISTORY" ||
    currentJobStep === "COMPLETED";
  const isFinalizing =
    currentJobStep === "FINALIZING_ENROLLMENTS" ||
    currentJobStep === "GENERATING_HISTORY" ||
    currentJobStep === "COMPLETED";
  const isHistory = currentJobStep === "GENERATING_HISTORY" || currentJobStep === "COMPLETED";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-4xl mx-auto">
      <div className="mb-8 border-b border-slate-100 pb-6 space-y-4">
        <div>
          <DashboardHeader
            title={titulo}
            description="O sistema faz tudo automaticamente. Evite fechar esta janela durante a execução."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Secretaria", href: "/secretaria" },
              { label: "Fechamento Acadêmico" },
            ]}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="rounded border p-2" value={acao} onChange={(e) => setAcao(e.target.value as any)}>
            <option value="fechar_trimestre">Fechar trimestre</option>
            <option value="fechar_ano">Fechar ano</option>
          </select>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-slate-400">Ano letivo</label>
            <select
              className="w-full rounded border p-2 text-sm"
              value={anoLetivoId}
              onChange={(e) => setAnoLetivoId(e.target.value)}
            >
              <option value="">Selecione o ano letivo</option>
              {anoLetivoOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-slate-400">Trimestre</label>
            <select
              className="w-full rounded border p-2 text-sm"
              value={periodoLetivoId}
              onChange={(e) => setPeriodoLetivoId(e.target.value)}
              disabled={acao !== "fechar_trimestre"}
            >
              <option value="">Selecione o trimestre</option>
              {periodoOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <input
            className="rounded border p-2"
            placeholder="Turmas (opcional, IDs separados por vírgula)"
            value={turmaIds}
            onChange={(e) => setTurmaIds(e.target.value)}
          />
        </div>
        {validacaoMensagem ? <p className="text-sm text-amber-700">{validacaoMensagem}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={validarSanidade}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            Verificar se está tudo pronto
          </button>
          <Link
            href="/secretaria/fechamento-academico/sanidade"
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold"
          >
            Abrir sanidade detalhada
          </Link>
          <a
            href="/docs/academico/runbook-fechamento-academico"
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold"
            target="_blank"
            rel="noreferrer"
          >
            Ver runbook
          </a>
        </div>
      </div>

      {currentState === "falha" && erroFatal && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-3 font-medium text-sm">
          <AlertTriangle className="w-5 h-5" />
          {erroFatal}
          <button onClick={() => setCurrentState("pronto")} className="ml-auto text-red-900 underline">
            Tentar novamente
          </button>
        </div>
      )}

      {currentState === "pronto" && !sanidadeOk ? (
        <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-sm">
          Valide a sanidade antes de iniciar o fecho.
        </div>
      ) : null}

      {currentState === "pronto" && sanidadeOk && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={iniciarFecho}
            className="flex items-center gap-2 px-8 py-3 bg-[#1F6B3B] text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-[#1F6B3B]/20"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            Iniciar fecho
          </button>
        </div>
      )}

      <div className="space-y-4">
        <AutomatedStep
          isActive={currentState === "rodando" && currentJobStep === "CLOSING_PERIOD"}
          isDone={isFinalizing}
          isPending={currentState === "pronto" || !isClosing}
          icon={<Lock className="w-5 h-5" />}
          title="1. Fechar notas e frequências"
          description="Bloqueando edições e preparando o fecho."
        />

        <AutomatedStep
          isActive={currentState === "rodando" && currentJobStep === "FINALIZING_ENROLLMENTS"}
          isDone={isHistory}
          isPending={currentState === "pronto" || !isFinalizing}
          icon={<Calculator className="w-5 h-5" />}
          title="2. Calcular resultados"
          description="A apurar médias e situação final dos alunos."
        />

        <AutomatedStep
          isActive={currentState === "rodando" && currentJobStep === "GENERATING_HISTORY"}
          isDone={currentJobStep === "COMPLETED"}
          isPending={currentState === "pronto" || !isHistory}
          icon={<Archive className="w-5 h-5" />}
          title="3. Guardar histórico oficial"
          description="A guardar o histórico final de forma segura."
        />
      </div>

      {currentState === "concluido" && (
        <div className="mt-10 p-6 bg-[#E8F5EE] border border-[#1F6B3B]/20 rounded-xl text-center animate-klasse-fade-up">
          <CheckCircle2 className="w-12 h-12 text-[#1F6B3B] mx-auto mb-3" />
          <h3 className="text-xl font-bold text-[#1F6B3B] font-sora">Fecho concluído com sucesso</h3>
          <button
            onClick={() => router.push(buildPortalHref(escolaParam, "/secretaria"))}
            className="mt-6 px-6 py-2.5 bg-[#1F6B3B] text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all inline-flex items-center gap-2"
          >
            Voltar ao painel <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function AutomatedStep({
  isActive,
  isDone,
  isPending,
  icon,
  title,
  description,
}: {
  isActive: boolean;
  isDone: boolean;
  isPending: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const borderColor = isActive
    ? "border-[#E3B23C] ring-4 ring-[#E3B23C]/10 bg-white"
    : isDone
      ? "border-[#1F6B3B]/30 bg-slate-50/50"
      : "border-slate-100 bg-slate-50 opacity-60";
  const iconBg = isActive
    ? "bg-[#E3B23C]/10 text-[#E3B23C]"
    : isDone
      ? "bg-[#1F6B3B] text-white"
      : "bg-slate-200 text-slate-400";

  return (
    <div className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all duration-500 ${borderColor}`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full flex-shrink-0 transition-colors ${iconBg}`}>
          {isDone ? <CheckCircle2 className="w-5 h-5" /> : icon}
        </div>
        <div>
          <h3 className={`text-sm md:text-base font-bold font-sora ${isActive || isDone ? "text-slate-900" : "text-slate-500"}`}>
            {title}
          </h3>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="ml-4 flex-shrink-0">
        {isActive && <RefreshCw className="w-5 h-5 text-[#E3B23C] animate-spin" />}
        {isDone && <span className="text-xs font-bold uppercase tracking-wider text-[#1F6B3B]">OK</span>}
        {isPending && <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pendente</span>}
      </div>
    </div>
  );
}
