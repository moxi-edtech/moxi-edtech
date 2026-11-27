"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Users,
  FileText,
  FileWarning,
  Megaphone,
  Banknote,
  CalendarX,
  CalendarCheck,
  FileEdit,
  UsersRound,
  RefreshCcw,
  Upload,
  UserCheck,
  KeyRound,
  Printer,
  Share2,
  MessageCircle,
  Plus,
  Search,
  ListOrdered,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { createClient } from "@/lib/supabaseClient";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BuscaBalcaoRapido } from "@/components/secretaria/BuscaBalcaoRapido";
import { ModalShell } from "@/components/ui/ModalShell";
import { DashboardHeader, NoticePanel } from "@/components/dashboard";
import type { NoticeItemData } from "@/components/dashboard/NoticePanel";
import OperacoesPainelHub from "@/components/layout/operacoes/OperacoesPainelHub";
import {
  OperationalMetricCard,
  OperationalMetricSkeleton,
} from "@/components/shared/OperationalMetricCard";
import { EstadoVitalBanner } from "@/components/layout/escola-admin/EstadoVitalBanner";
import type { EstadoVital } from "@/components/layout/escola-admin/dashboard.types";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import ExpedienteDashboardCard from "@/components/secretaria/ExpedienteDashboardCard";
import { FichaRapidaModal } from "@/components/secretaria/FichaRapidaModal";
import type { DashboardCounts, DashboardRecentes } from "./types";

const ResumoCaixaSecretaria = dynamic(
  () =>
    import("@/components/secretaria/ResumoCaixaSecretaria").then(
      (mod) => mod.ResumoCaixaSecretaria,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="A carregar resumo de caixa"
        className="h-20 rounded-xl border border-border bg-card motion-safe:animate-pulse"
      />
    ),
  },
);

const FilaAtendimentoModal = dynamic(
  () =>
    import("@/components/secretaria/FilaAtendimentoModal").then(
      (mod) => mod.FilaAtendimentoModal,
    ),
  { ssr: false },
);

const AdmissaoWizardClient = dynamic(
  () => import("@/components/secretaria/AdmissaoWizardClient"),
  { ssr: false, loading: () => <ModalLoading /> },
);

const PautaRapidaModal = dynamic(
  () =>
    import("@/components/secretaria/PautaRapidaModal").then(
      (mod) => mod.PautaRapidaModal,
    ),
  { ssr: false, loading: () => <ModalLoading /> },
);

const JustificarFaltaModal = dynamic(
  () =>
    import("@/components/secretaria/JustificarFaltaModal").then(
      (mod) => mod.JustificarFaltaModal,
    ),
  { ssr: false, loading: () => <ModalLoading /> },
);

const ProvasModal = dynamic(() => import("@/components/provas/ProvasModal"), {
  ssr: false,
});
const QuickDocHub = dynamic(
  () => import("@/components/secretaria/QuickDocHub"),
  { ssr: false, loading: () => <ModalLoading /> },
);

const BalcaoWorkspace = dynamic(
  () =>
    import("@/components/secretaria/BalcaoWorkspace").then(
      (mod) => mod.BalcaoWorkspace,
    ),
  { ssr: false, loading: () => <ModalLoading /> },
);

function ModalLoading() {
  return (
    <div
      role="status"
      aria-label="A carregar formulário"
      className="h-48 rounded-xl bg-muted motion-safe:animate-pulse"
    />
  );
}

type BalcaoModal =
  | "matricular"
  | "documentos"
  | "cobranca"
  | "faltas"
  | "notas"
  | "turma_docs"
  | "atendimento_aluno"
  | null;

export function Dashboard({
  counts,
  recentes,
  escolaId: resolvedEscolaId,
}: {
  escolaId?: string | null;
  counts: DashboardCounts | null;
  recentes: DashboardRecentes | null;
}) {
  const {
    escolaId: contextEscolaId,
    escolaSlug,
    isLoading: escolaLoading,
  } = useEscolaId();
  const escolaId = resolvedEscolaId ?? contextEscolaId;
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [filaOpen, setFilaOpen] = useState(false);
  const [provasOpen, setProvasOpen] = useState(false);
  const [balcaoModal, setBalcaoModal] = useState<BalcaoModal>(null);
  const [nowMs] = useState(() => Date.now());
  const [userName, setUserName] = useState<string | null>(null);
  const [noticeView, setNoticeView] = useState<"general" | "fichas" | null>(null);
  const [productivity, setProductivity] = useState<{
    scope: string;
    count: number | null;
    alerts: any[];
    error: boolean;
  } | null>(null);
  const [selectedAlunoIdForFicha, setSelectedAlunoIdForFicha] = useState<
    string | null
  >(null);
  const [selectedAlunoIdForBalcao, setSelectedAlunoIdForBalcao] = useState<
    string | null
  >(null);
  const [selectedCandidaturaId, setSelectedCandidaturaId] = useState<
    string | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOperationalPanels, setShowOperationalPanels] = useState(false);

  const productivityScope = JSON.stringify([escolaId, refreshKey]);
  const currentProductivity = productivity?.scope === productivityScope ? productivity : null;
  const produtividadeAlerts = useMemo(() => currentProductivity?.alerts ?? [], [currentProductivity]);

  useEffect(() => {
    if (!escolaId || !showOperationalPanels) return;
    const controller = new AbortController();
    const scope = productivityScope;
    void fetch(`/api/secretaria/balcao/produtividade?escolaId=${encodeURIComponent(escolaId)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async response => {
      const body = await response.json();
      if (!response.ok || !body?.ok) throw new Error("Avisos indisponíveis");
      if (!controller.signal.aborted) setProductivity({
        scope,
        count: typeof body.documentos_pendentes === "number" && Number.isFinite(body.documentos_pendentes)
          ? body.documentos_pendentes : null,
        alerts: Array.isArray(body.alertas_notificacoes) ? body.alertas_notificacoes : [],
        error: false,
      });
    }).catch(() => {
      if (!controller.signal.aborted) setProductivity({ scope, count: null, alerts: [], error: true });
    });
    return () => controller.abort();
  }, [escolaId, productivityScope, showOperationalPanels]);

  useEffect(() => { setNoticeView(null); }, [escolaId]);

  const refreshProdutividade = useCallback(
    () => setRefreshKey((prev) => prev + 1),
    [],
  );

  const escolaParamFromPath = useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const escolaParam = escolaParamFromPath || escolaSlug || escolaId;
  const {
    data: academicState,
    error: academicError,
    isLoading: academicLoading,
    mutate: refreshAcademicState,
  } = useSWR(
    escolaId
      ? `/api/escola/${encodeURIComponent(escolaId)}/admin/estado-hoje`
      : null,
    async (url: string): Promise<EstadoVital | null> => {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body?.ok)
        throw new Error("Estado académico indisponível");
      if (body.estado == null) return null;
      if (
        body.estado.escola_id !== escolaId ||
        typeof body.estado.hoje_bloqueado_pedagogico !== "boolean" ||
        !["PRE_INICIO", "REGULAR", "EXAMES", "POS_ENCERRAMENTO"].includes(
          body.estado.fase_operacional,
        )
      ) {
        throw new Error("Estado académico inválido");
      }
      return body.estado;
    },
    {
      dedupingInterval: 15_000,
      shouldRetryOnError: false,
      revalidateOnReconnect: true,
    },
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const name =
        data.user?.user_metadata?.full_name || data.user?.user_metadata?.name;
      if (name) {
        const parts = name.split(" ").filter(Boolean);
        if (parts.length > 1) {
          setUserName(`${parts[0]} ${parts[parts.length - 1]}`);
        } else {
          setUserName(parts[0]);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!escolaId) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(
        () => setShowOperationalPanels(true),
        { timeout: 1500 },
      );
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(() => setShowOperationalPanels(true), 300);
    return () => window.clearTimeout(id);
  }, [escolaId]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const dashboardTitle = userName ? `${greeting}, ${userName}!` : "Secretaria";
  const anoLetivoLabel =
    counts?.anoLetivo != null
      ? `${counts.anoLetivo}/${counts.anoLetivo + 1}`
      : "ano atual";
  const matriculadosHref = buildPortalHref(
    escolaParam,
    `/secretaria/alunos${counts?.anoLetivoId ? `?ano_letivo_id=${encodeURIComponent(counts.anoLetivoId)}` : ""}`,
  );

  const handleNoticeAction = (item: any) => {
    if (item.type === "FICHA_RAPIDA" && item.aluno_id) {
      setNoticeView(null);
      setSelectedAlunoIdForFicha(item.aluno_id);
    } else if (item.type === "BIRTHDAY_WHATSAPP") {
      const msg = encodeURIComponent(
        `Olá! A Escola ${escolaSlug || ""} deseja um feliz aniversário ao aluno ${item.nome_aluno}! Que este dia seja repleto de alegria.`,
      );
      const phone = item.telefone_whatsapp?.replace(/\D/g, "");
      if (phone) window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    } else if (item.type === "DEBT_PAYMENT" && item.aluno_id) {
      setNoticeView(null);
      // Abre o balcão de atendimento no modal para este aluno
      setSelectedAlunoIdForBalcao(item.aluno_id);
      setBalcaoModal("atendimento_aluno");
    } else if (item.type === "CANDIDATURA_PENDENTE" && item.candidatura_id) {
      setNoticeView(null);
      // Abre o wizard de admissão no modal com a candidatura selecionada
      setSelectedCandidaturaId(item.candidatura_id);
      setBalcaoModal("matricular");
    } else if (item.type === "FECHO_TRIMESTRE") {
      setNoticeView(null);
      setBalcaoModal("notas");
    } else if (item.action_href) {
      window.location.href = item.action_href;
    }
  };

  const avisoFechoTrimestre = useMemo(() => {
    const fecho = recentes?.fecho_trimestre;
    if (!fecho?.trava_notas_em || nowMs === null) return null;
    const prazo = new Date(fecho.trava_notas_em);
    if (Number.isNaN(prazo.getTime())) return null;
    const diffMs = prazo.getTime() - nowMs;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0 || days > 5) return null;
    const suffix = fecho.numero
      ? ` do ${fecho.numero}º trimestre`
      : " do trimestre";
    const diaLabel = days === 1 ? "dia" : "dias";
    const titulo = `Fecho${suffix}`;
    const resumo =
      days === 0
        ? "O fecho das pautas é hoje. Confirme as notas pendentes."
        : `Faltam ${days} ${diaLabel} para o fecho das pautas. Verifique os professores com notas em atraso.`;
    return {
      id: "fecho-trimestre",
      type: "FECHO_TRIMESTRE",
      titulo,
      resumo,
      data: prazo.toISOString(),
      action_label: "Ver pautas pendentes",
      action_href: buildPortalHref(escolaParam, "/secretaria/notas"),
    };
  }, [escolaParam, nowMs, recentes?.fecho_trimestre]);
  const avisoImportacao = useMemo(() => {
    const pendencias = recentes?.pendencias ?? counts?.pendencias ?? 0;
    if (pendencias > 0) return null;
    if (!counts) return null;
    const semDados = (counts.alunos ?? 0) === 0 && (counts.turmas ?? 0) === 0;
    if (!semDados) return null;
    return {
      id: "importacao-inicial",
      titulo: "Importar dados da escola",
      resumo:
        "Faça a migração inicial de alunos e turmas para começar a operação.",
      data: new Date().toISOString(),
      action_label: "Iniciar importação",
      action_href: buildPortalHref(escolaParam, "/secretaria/migracao/alunos"),
    };
  }, [counts, escolaParam, recentes?.pendencias]);
  const avisos = useMemo(() => {
    const buildNoticeId = (source: string, item: any, fallback: string) => {
      const parts = [
        source,
        item?.type ?? "generic",
        item?.aluno_id ?? item?.candidatura_id ?? item?.id ?? "no-entity",
        item?.data ?? item?.action_href ?? fallback,
      ];

      return parts.map((part) => String(part).trim()).join(":");
    };

    const base = recentes?.avisos_recentes ?? [];
    const extras = [avisoFechoTrimestre, avisoImportacao]
      .filter(Boolean)
      .map((item, index) => ({
        ...item,
        id: buildNoticeId("extra", item, `extra-${index}`),
      }));
    const prodAlerts = produtividadeAlerts.map((a) => ({
      ...a,
      id: buildNoticeId("prod", a, `prod-${a.type ?? "alert"}`),
      action_href: buildPortalHref(
        escolaParam,
        `/secretaria/alunos?id=${a.aluno_id}`,
      ),
    }));
    const baseNotices = base.map((item, index) => ({
      ...item,
      id: buildNoticeId("base", item, `base-${index}`),
    }));

    const deduped = new Map<string, NoticeItemData>();
    for (const item of [
      ...(extras as typeof base),
      ...prodAlerts,
      ...baseNotices,
    ]) {
      deduped.set(String(item.id), item);
    }

    return Array.from(deduped.values());
  }, [
    avisoFechoTrimestre,
    avisoImportacao,
    recentes?.avisos_recentes,
    produtividadeAlerts,
    escolaParam,
  ]);
  const fichaAvisos = useMemo(() => Array.from(new Map<string, NoticeItemData>(avisos.filter(item => item.type === "FICHA_RAPIDA").map(item => [item.aluno_id ?? item.id, item])).values()), [avisos]);
  const generalAvisos = useMemo(() => avisos.filter(item => item.type !== "FICHA_RAPIDA"), [avisos]);
  const publicLandingUrl = useMemo(() => {
    if (!escolaSlug || escolaId !== contextEscolaId) return null;
    return `https://klasse.ao/admissoes/${escolaSlug}`;
  }, [escolaSlug, escolaId, contextEscolaId]);

  const copyPublicUrl = async () => {
    if (!publicLandingUrl) return;
    try {
      await navigator.clipboard.writeText(publicLandingUrl);
      toast.success("Link público copiado!");
    } catch {
      toast.error("Não foi possível copiar o link. Tente partilhar.");
    }
  };

  const sharePublicUrl = () => {
    if (publicLandingUrl) {
      const msg = encodeURIComponent(
        `Olá! Faça a sua inscrição online no Colégio através deste link: ${publicLandingUrl}`,
      );
      window.open(`https://wa.me/?text=${msg}`, "_blank");
    }
  };

  const metrics = [
    {
      key: "alunos",
      label: "Matriculados",
      value: counts?.alunos,
      icon: Users,
      description: `Matrículas confirmadas · ${anoLetivoLabel}`,
      href: matriculadosHref,
      action: "Ver alunos matriculados",
    },
    {
      key: "turmas",
      label: "Turmas",
      value: counts?.turmas,
      icon: UsersRound,
      description: `Turmas do ano lectivo · ${anoLetivoLabel}`,
      href: buildPortalHref(escolaParam, "/secretaria/turmas"),
      action: "Consultar turmas",
    },
    {
      key: "pendencias",
      label: "Pendências",
      value: recentes?.pendencias ?? counts?.pendencias,
      icon: FileText,
      description: "Matrículas e importações que precisam de validação.",
      href: buildPortalHref(escolaParam, "/secretaria/alertas"),
      action: "Tratar pendências",
    },
  ];
  const selectedMetric = metrics.find((metric) => metric.key === metricKey);

  return (
    <div
      className={`${PORTAL_PAGE_INSET} operations-dashboard-flow pb-16`}
      style={{ containerType: "inline-size" }}
    >
      <DashboardHeader
        title="Secretaria"
        largeDesktopTitle
        description={
          userName
            ? `${dashboardTitle} Atendimento e expediente do dia.`
            : "Atendimento e expediente do dia"
        }
        actions={
          publicLandingUrl && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyPublicUrl}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
              >
                <Share2 size={16} aria-hidden="true" /> Copiar link de admissão
              </button>
              <button
                type="button"
                onClick={sharePublicUrl}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
              >
                <MessageCircle size={16} aria-hidden="true" /> Partilhar
              </button>
            </div>
          )
        }
      />

      <div className="space-y-4">
        {academicLoading || (escolaLoading && !escolaId) ? (
          <div
            role="status"
            aria-label="A carregar estado académico"
            className="h-20 rounded-xl border border-border bg-card motion-safe:animate-pulse"
          />
        ) : academicState && !academicError ? (
          <EstadoVitalBanner
            estado={academicState}
            compact
            calendarHref={buildPortalHref(
              escolaParam,
              "/secretaria/calendario",
            )}
          />
        ) : (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
          >
            <span>
              {academicError
                ? "Estado académico indisponível."
                : "Sem contexto académico activo."}
            </span>
            {academicError ? (
              <button
                type="button"
                onClick={() => void refreshAcademicState()}
                className="min-h-10 rounded-xl border border-border px-3 font-medium text-foreground"
              >
                Tentar novamente
              </button>
            ) : (
              <Link
                href={buildPortalHref(escolaParam, "/secretaria/calendario")}
                className="font-medium text-foreground hover:underline"
              >
                Consultar calendário
              </Link>
            )}
          </div>
        )}
      </div>

      <section
        aria-labelledby="secretaria-caixa-title"
        className="min-w-0 space-y-4"
      >
        <h2
          id="secretaria-caixa-title"
          className="text-base font-semibold text-foreground"
        >
          O meu caixa hoje
        </h2>
        {escolaId && showOperationalPanels ? (
          <ResumoCaixaSecretaria escolaId={escolaId} refreshKey={refreshKey} />
        ) : (
          <div className="grid min-w-0 gap-4 @min-[520px]:grid-cols-2">
            {[0, 1].map((key) => (
              <OperationalMetricSkeleton key={key} />
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="secretaria-resumo-title"
        className="min-w-0 space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="secretaria-resumo-title"
            className="text-base font-semibold text-foreground"
          >
            Visão geral da secretaria
          </h2>
          <p className="text-xs text-muted-foreground">
            Ano lectivo {anoLetivoLabel}
          </p>
        </div>
        <div className="operations-daily-grid grid">
          {metrics.map((metric) => (
            <OperationalMetricCard
              key={metric.key}
              label={metric.label}
              value={metric.value}
              icon={metric.icon}
              description={metric.description}
              needsAttention={
                metric.key === "pendencias" && (metric.value ?? 0) > 0
              }
              onClick={() => setMetricKey(metric.key)}
              dialogOpen={metricKey === metric.key}
            />
          ))}
          {escolaId && <OperacoesPainelHub escolaId={escolaId} onlyReopen inlineReopen key={escolaId} />}
          {escolaId && !currentProductivity ? (
            <>
              <div role="status" aria-label="A carregar fichas incompletas e avisos" aria-busy="true">
                <OperationalMetricSkeleton />
              </div>
              <OperationalMetricSkeleton />
            </>
          ) : (
            <>
              <OperationalMetricCard
                label="Fichas incompletas"
                icon={FileWarning}
                value={currentProductivity?.count ?? null}
                needsAttention={(currentProductivity?.count ?? 0) > 0}
                description="Alunos com dados ou documentos em falta"
                onClick={() => setNoticeView("fichas")}
                dialogOpen={noticeView === "fichas"}
              />
              <OperationalMetricCard
                label="Avisos gerais"
                icon={Megaphone}
                value={currentProductivity && !currentProductivity.error ? generalAvisos.length : null}
                needsAttention={generalAvisos.some(item => item.is_priority)}
                description="Avisos disponíveis nesta consulta"
                onClick={() => setNoticeView("general")}
                dialogOpen={noticeView === "general"}
              />
            </>
          )}
        </div>
      </section>

      <section
        aria-labelledby="secretaria-atendimento-title"
        className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="secretaria-atendimento-title"
              className="text-base font-semibold text-foreground"
            >
              Atendimento
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Encontre o aluno e conclua a operação no Balcão.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
          >
            <Search size={16} aria-hidden="true" /> Pesquisa global
          </button>
        </div>
        <div className="grid min-w-0 gap-4 @min-[920px]:grid-cols-[minmax(0,1fr)_auto] @min-[920px]:items-center">
          <div className="min-w-0">
            <BuscaBalcaoRapido
              inline
              escolaId={escolaId}
              onSuccess={refreshProdutividade}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setFilaOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={filaOpen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
            >
              <ListOrdered size={16} aria-hidden="true" /> Fila de atendimento
            </button>
            <button
              type="button"
              onClick={() => setBalcaoModal("matricular")}
              aria-haspopup="dialog"
              aria-expanded={balcaoModal === "matricular"}
              disabled={!escolaId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-klasse-gold-700 px-4 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50"
            >
              <Plus size={16} aria-hidden="true" /> Matricular aluno
            </button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="secretaria-acoes-title"
        className="min-w-0 space-y-4"
      >
        <h2
          id="secretaria-acoes-title"
          className="text-base font-semibold text-foreground"
        >
          Ações rápidas
        </h2>
        <div className="operations-actions-grid grid">
          {escolaId && (
            <ExpedienteDashboardCard escolaId={escolaId} portal="secretaria" />
          )}
          <AcaoRapidaCard
            dashboardCompact
            icon={<Banknote className="h-5 w-5" />}
            label="Pagar propina"
            sublabel="No Balcão"
            onClick={() => setBalcaoModal("cobranca")}
            dialogOpen={balcaoModal === "cobranca"}
            disabled={!escolaId}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<FileText className="h-5 w-5" />}
            label="Emitir documento"
            sublabel="No Balcão"
            onClick={() => setBalcaoModal("documentos")}
            dialogOpen={balcaoModal === "documentos"}
            disabled={!escolaId}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<Printer className="h-5 w-5" />}
            label="Listas de turmas"
            sublabel="Exportação nominal"
            onClick={() => setBalcaoModal("turma_docs")}
            dialogOpen={balcaoModal === "turma_docs"}
            disabled={!escolaId}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<Printer className="h-5 w-5" />}
            label="Imprimir provas"
            sublabel="Por turma ou aluno"
            onClick={() => setProvasOpen(true)}
            dialogOpen={provasOpen}
            disabled={!escolaId}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<CalendarCheck className="h-5 w-5" />}
            label="Calendário de avaliações"
            sublabel="Planear e imprimir"
            href={buildPortalHref(
              escolaParam,
              "/secretaria/operacoes-academicas/calendario-avaliacoes",
            )}
            disabled={!escolaId}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<CalendarX className="h-5 w-5" />}
            label="Justificar falta"
            sublabel="Registar ausência"
            onClick={() => setBalcaoModal("faltas")}
            dialogOpen={balcaoModal === "faltas"}
            disabled={!escolaId}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<FileEdit className="h-5 w-5" />}
            label="Lançar nota"
            sublabel="Abrir pauta"
            onClick={() => setBalcaoModal("notas")}
            dialogOpen={balcaoModal === "notas"}
            disabled={!escolaId}
          />
        </div>
      </section>

      <section
        aria-labelledby="secretaria-gestao-title"
        className="min-w-0 space-y-4"
      >
        <h2
          id="secretaria-gestao-title"
          className="text-base font-semibold text-foreground"
        >
          Gestão
        </h2>
        <div className="operations-actions-grid grid">
          <AcaoRapidaCard
            dashboardCompact
            icon={<UserCheck className="h-5 w-5" />}
            label="Professores"
            href={buildPortalHref(escolaParam, "/secretaria/professores")}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<RefreshCcw className="h-5 w-5" />}
            label="Rematrículas"
            href={buildPortalHref(escolaParam, "/secretaria/rematricula")}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<KeyRound className="h-5 w-5" />}
            label="Acesso dos alunos"
            href={buildPortalHref(escolaParam, "/secretaria/acesso-alunos")}
          />
          <AcaoRapidaCard
            dashboardCompact
            icon={<Upload className="h-5 w-5" />}
            label="Migração"
            href={buildPortalHref(escolaParam, "/secretaria/migracao/alunos")}
          />
        </div>
      </section>

      <PortalSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Pesquisa global"
        description="Pesquisar alunos, matrículas e documentos"
        size="medium"
      >
        <GlobalSearch
          escolaId={escolaId}
          portal="secretaria"
          placeholder="Buscar aluno, matrícula ou documento..."
          disabledText={
            escolaLoading
              ? "Carregando escola..."
              : "Vincule-se a uma escola para pesquisar"
          }
        />
      </PortalSheet>
      <PortalSheet
        open={Boolean(selectedMetric)}
        onClose={() => setMetricKey(null)}
        title={selectedMetric?.label ?? "Indicador"}
        description={`Secretaria · ${anoLetivoLabel}`}
        size="compact"
      >
        {selectedMetric && (
          <>
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {selectedMetric.value?.toLocaleString("pt-AO") ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedMetric.value == null
                ? "Dados indisponíveis."
                : selectedMetric.description}
            </p>
            {selectedMetric.key === "alunos" && (
              <div className="rounded-xl border border-border p-3 text-sm">
                <p className="text-muted-foreground">Matrículas de hoje</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {counts?.matriculas?.toLocaleString("pt-AO") ?? "—"}
                </p>
                <Link href={buildPortalHref(escolaParam, "/secretaria/matriculas")} className="mt-2 inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline">
                  Consultar matrículas
                </Link>
              </div>
            )}
            <Link
              href={selectedMetric.href}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              {selectedMetric.action}
            </Link>
          </>
        )}
      </PortalSheet>

      <PortalSheet
        open={noticeView !== null}
        onClose={() => setNoticeView(null)}
        title={noticeView === "fichas" ? "Fichas incompletas" : "Avisos gerais"}
        description={noticeView === "fichas" ? "Regularize os dados dos alunos." : "Consulte os avisos que precisam de atenção."}
        size="expanded"
      >
        {(!currentProductivity || currentProductivity.error) && (
          <div role="status" className="space-y-2 text-sm text-muted-foreground">
            <p>{currentProductivity?.error ? "Não foi possível carregar todos os avisos." : "A carregar avisos..."}</p>
            {currentProductivity?.error && <button type="button" className="min-h-10 rounded-xl border border-border px-3 text-foreground" onClick={refreshProdutividade}>Tentar novamente</button>}
          </div>
        )}
        <NoticePanel
          key={noticeView ?? "closed"}
          items={noticeView === "fichas" ? fichaAvisos : generalAvisos}
          showHeader={false}
          availableFiltersOnly
          onAction={handleNoticeAction}
          onSnooze={refreshProdutividade}
        />
        {noticeView === "fichas" && <Link
          href={buildPortalHref(escolaParam, "/secretaria/alunos")}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-foreground"
        >Consultar todos os alunos</Link>}
      </PortalSheet>

      {selectedAlunoIdForFicha && (
        <FichaRapidaModal
          alunoId={selectedAlunoIdForFicha}
          onClose={() => setSelectedAlunoIdForFicha(null)}
          onSuccess={refreshProdutividade}
        />
      )}

      <ModalShell
        open={balcaoModal === "turma_docs"}
        title="Listas de turmas"
        description="Emissão rápida de mapas, pautas e listas nominais por turma."
        onClose={() => setBalcaoModal(null)}
      >
        <QuickDocHub escolaId={escolaId} initialNominal />
      </ModalShell>

      {provasOpen && escolaParam && (
        <ProvasModal
          escolaId={escolaParam}
          onClose={() => setProvasOpen(false)}
        />
      )}
      <FilaAtendimentoModal
        open={filaOpen}
        onClose={() => setFilaOpen(false)}
      />
      <ModalShell
        open={balcaoModal === "matricular"}
        title="Nova matrícula"
        description="Admissão rápida sem sair do dashboard."
        onClose={() => {
          setBalcaoModal(null);
          setSelectedCandidaturaId(null);
        }}
      >
        {escolaId ? (
          <div className="space-y-4">
            <AdmissaoWizardClient
              escolaId={escolaId}
              initialCandidaturaId={selectedCandidaturaId}
            />
            {!selectedCandidaturaId && (
              <Link
                href={buildPortalHref(escolaParam, "/secretaria/admissoes")}
                className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Abrir admissões completas
              </Link>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Escola não identificada.
          </div>
        )}
      </ModalShell>

      {balcaoModal === "atendimento_aluno" &&
      escolaId &&
      selectedAlunoIdForBalcao ? (
        <BalcaoWorkspace
          open
          escolaId={escolaId}
          aluno={{
            id: selectedAlunoIdForBalcao,
            label: "Atendimento ao aluno",
          }}
          actionId="desk"
          onClose={() => {
            setBalcaoModal(null);
            setSelectedAlunoIdForBalcao(null);
          }}
          onSuccess={refreshProdutividade}
        />
      ) : null}
      <ModalShell
        open={balcaoModal === "documentos"}
        title="Emitir documento"
        description="Selecione o aluno; o documento será tratado no mesmo Balcão."
        onClose={() => setBalcaoModal(null)}
      >
        <BuscaBalcaoRapido
          escolaId={escolaId}
          initialAction="document"
          onSuccess={refreshProdutividade}
        />
      </ModalShell>
      <ModalShell
        open={balcaoModal === "cobranca"}
        title="Cobrar propina"
        description="Busque o aluno e finalize o pagamento."
        onClose={() => setBalcaoModal(null)}
      >
        <div className="space-y-3">
          <BuscaBalcaoRapido
            escolaId={escolaId}
            initialAction="payment"
            onSuccess={refreshProdutividade}
          />
          <p className="text-xs text-muted-foreground">
            Localize o aluno; o pagamento será concluído no mesmo Balcão de
            Atendimento.
          </p>
        </div>
      </ModalShell>
      <ModalShell
        open={balcaoModal === "faltas"}
        title="Justificar falta"
        description="Selecione a turma e registre as faltas."
        onClose={() => setBalcaoModal(null)}
      >
        <JustificarFaltaModal />
      </ModalShell>
      <ModalShell
        open={balcaoModal === "notas"}
        title="Lançar nota"
        description="Selecione a turma e gere a pauta rapidamente."
        onClose={() => setBalcaoModal(null)}
      >
        <PautaRapidaModal />
      </ModalShell>
    </div>
  );
}
