"use client";
import Link from "next/link";
import {
  Users,
  FileText,
  Banknote,
  CalendarX,
  FileEdit,
  AlertCircle,
  UserPlus,
  Building,
  RefreshCcw,
  Upload,
  UserCheck,
  KeyRound,
  Printer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { createClient } from "@/lib/supabaseClient";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BuscaBalcaoRapido } from "@/components/secretaria/BuscaBalcaoRapido";
import { FilaAtendimentoModal } from "@/components/secretaria/FilaAtendimentoModal";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
import AdmissaoWizardClient from "@/components/secretaria/AdmissaoWizardClient";
import { PautaRapidaModal } from "@/components/secretaria/PautaRapidaModal";
import { JustificarFaltaModal } from "@/components/secretaria/JustificarFaltaModal";
import { ModalShell } from "@/components/ui/ModalShell";
import { DashboardHeader, TaskList, NoticePanel } from "@/components/dashboard";
import StatCard from "@/components/shared/StatCard";
import SecaoLabel from "@/components/shared/SecaoLabel";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import { RadarOperacional, type OperationalAlert } from "@/components/feedback/FeedbackSystem";
import QuickDocHub from "@/components/secretaria/QuickDocHub";
import { ResumoCaixaSecretaria } from "@/components/secretaria/ResumoCaixaSecretaria";
import { MinhaProdutividade } from "@/components/secretaria/MinhaProdutividade";
import { FichaRapidaModal } from "@/components/secretaria/FichaRapidaModal";
import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";
import type { DashboardCounts, DashboardRecentes } from "./types";

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
}: {
  counts: DashboardCounts | null;
  recentes: DashboardRecentes | null;
}) {
  const router = useRouter();
  const { escolaId, escolaSlug, isLoading: escolaLoading } = useEscolaId();
  const pathname = usePathname();
  const [filaOpen, setFilaOpen] = useState(false);
  const [balcaoModal, setBalcaoModal] = useState<BalcaoModal>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [produtividadeAlerts, setProdutividadeAlerts] = useState<any[]>([]);
  const [totalPendentesFicha, setTotalPendentesFicha] = useState(0);
  const [selectedAlunoIdForFicha, setSelectedAlunoIdForFicha] = useState<string | null>(null);
  const [selectedAlunoIdForBalcao, setSelectedAlunoIdForBalcao] = useState<string | null>(null);
  const [selectedCandidaturaId, setSelectedCandidaturaId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProdutividadeData = (data: any) => {
    if (data.alertas_notificacoes) setProdutividadeAlerts(data.alertas_notificacoes);
    if (data.documentos_pendentes !== undefined) setTotalPendentesFicha(data.documentos_pendentes);
  };

  const refreshProdutividade = () => setRefreshKey(prev => prev + 1);

  const escolaParamFromPath = useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const escolaParam = escolaSlug || escolaParamFromPath || escolaId;

  useEffect(() => {
    setNowMs(Date.now());
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name;
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const dashboardTitle = userName ? `${greeting}, ${userName}!` : "Secretaria";

  const handleNoticeAction = (item: any) => {
    if (item.type === 'FICHA_RAPIDA' && item.aluno_id) {
       setSelectedAlunoIdForFicha(item.aluno_id);
    } else if (item.type === 'BIRTHDAY_WHATSAPP') {
       const msg = encodeURIComponent(`Olá! A Escola ${escolaSlug || ''} deseja um feliz aniversário ao aluno ${item.nome_aluno}! Que este dia seja repleto de alegria.`);
       const phone = item.telefone_whatsapp?.replace(/\D/g, '');
       if (phone) window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    } else if (item.type === 'DEBT_PAYMENT') {
       // Abre o balcão de atendimento no modal para este aluno
       setSelectedAlunoIdForBalcao(item.aluno_id);
       setBalcaoModal("atendimento_aluno");
    } else if (item.type === 'CANDIDATURA_PENDENTE') {
       // Abre o wizard de admissão no modal com a candidatura selecionada
       setSelectedCandidaturaId(item.candidatura_id);
       setBalcaoModal("matricular");
    } else if (item.id === 'fecho-trimestre') {
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
    const suffix = fecho.numero ? ` do ${fecho.numero}º trimestre` : " do trimestre";
    const diaLabel = days === 1 ? "dia" : "dias";
    const titulo = `Fecho${suffix}`;
    const resumo =
      days === 0
        ? "O fecho das pautas é hoje. Confirme as notas pendentes."
        : `Faltam ${days} ${diaLabel} para o fecho das pautas. Verifique os professores com notas em atraso.`;
    return {
      id: "fecho-trimestre",
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
      resumo: "Faça a migração inicial de alunos e turmas para começar a operação.",
      data: new Date().toISOString(),
      action_label: "Iniciar importação",
      action_href: buildPortalHref(escolaParam, "/secretaria/migracao/alunos"),
    };
  }, [counts, escolaParam, recentes?.pendencias]);
  const avisos = useMemo(() => {
    const base = recentes?.avisos_recentes ?? [];
    const extras = [avisoFechoTrimestre, avisoImportacao].filter(Boolean);
    const prodAlerts = produtividadeAlerts.map(a => ({
       ...a,
       action_href: buildPortalHref(escolaParam, `/secretaria/alunos?id=${a.aluno_id}`)
    }));
    return [...(extras as typeof base), ...prodAlerts, ...base];
  }, [avisoFechoTrimestre, avisoImportacao, recentes?.avisos_recentes, produtividadeAlerts, escolaParam]);
  const alerts = useMemo(() => {
    const items: OperationalAlert[] = [];
    const pendencias = recentes?.pendencias ?? counts?.pendencias ?? 0;
    if (pendencias > 0) {
      items.push({
        id: "pendencias",
        severity: pendencias >= 5 ? "critical" : "warning",
        categoria: "academico",
        titulo: `${pendencias} pendência${pendencias !== 1 ? "s" : ""} no painel`,
        descricao: "Há matrículas ou importações que precisam de validação.",
        count: pendencias,
        link: buildPortalHref(escolaParam, "/secretaria/alertas"),
        link_label: "Ver pendências",
      });
    }

    const avisos = recentes?.avisos_recentes?.length ?? 0;
    if (avisos > 0) {
      items.push({
        id: "avisos",
        severity: "info",
        categoria: "documentos",
        titulo: "Avisos recentes do dia",
        descricao: "Revise os avisos mais recentes antes de encerrar o turno.",
        count: avisos,
        link: buildPortalHref(escolaParam, "/secretaria/avisos"),
        link_label: "Abrir avisos",
      });
    }

    if (totalPendentesFicha > 0) {
      items.push({
        id: "fichas-incompletas",
        severity: totalPendentesFicha > 20 ? "critical" : "warning",
        categoria: "documentos",
        titulo: `${totalPendentesFicha} alunos com ficha incompleta`,
        descricao: "Existem alunos ativos com falta de BI, Data de Nasc. ou Documentos.",
        count: totalPendentesFicha,
        link: buildPortalHref(escolaParam, "/secretaria/alunos"),
        link_label: "Regularizar Fichas",
      });
    }

    return items;
    }, [counts?.pendencias, escolaParam, recentes?.avisos_recentes?.length, recentes?.pendencias, totalPendentesFicha]);


  return (
    <div className="flex flex-col min-h-full bg-slate-50 font-sans text-slate-900">
      <div className="flex-1 flex">
        <main className="flex-1 p-6 lg:p-8 pb-32">
          <div className="max-w-5xl mx-auto space-y-8">
            <DashboardHeader
              title={dashboardTitle}
              description="Resumo operacional do dia"
              breadcrumbs={[
                { label: "Início", href: "." },
                { label: "Secretaria" },
              ]}
              actions={
                <div className="flex flex-col gap-3 items-stretch sm:flex-row sm:items-center sm:justify-end">
                  <GlobalSearch
                    escolaId={escolaId}
                    portal="secretaria"
                    placeholder="Buscar aluno, matrícula ou documento..."
                    disabledText={escolaLoading ? "Carregando escola..." : "Vincule-se a uma escola para pesquisar"}
                  />
                  <Link
                    href={buildPortalHref(escolaParam, "/secretaria/admissoes?nova=1")}
                    className="
                      inline-flex items-center justify-center gap-2
                      rounded-xl bg-klasse-gold px-4 py-2
                      text-sm font-semibold text-white
                      hover:brightness-95
                      focus:outline-none focus:ring-4 focus:ring-klasse-gold/20
                    "
                  >
                    Nova Matrícula
                  </Link>
                </div>
              }
            />

            <RadarOperacional alerts={alerts} role="secretaria" />
            
            {escolaId && <ResumoCaixaSecretaria escolaId={escolaId} />}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Alunos" value={counts?.alunos} icon={<Users size={16} />} tone="default" />
              <StatCard
                label="Matrículas Hoje"
                value={counts?.matriculas}
                icon={<UserPlus size={16} />}
                tone="default"
              />
              <StatCard label="Turmas Ativas" value={counts?.turmas} icon={<Building size={16} />} tone="default" />
              <StatCard
                label="Pendências"
                value={recentes?.pendencias ?? counts?.pendencias}
                icon={<AlertCircle size={16} />}
                tone={(recentes?.pendencias ?? counts?.pendencias ?? 0) > 0 ? "warning" : "default"}
              />
            </div>


            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <SecaoLabel>Busca rápida para atendimento</SecaoLabel>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[280px]">
                  <BuscaBalcaoRapido escolaId={escolaId} />
                </div>
                <button
                  type="button"
                  onClick={() => setFilaOpen(true)}
                  className="rounded-lg border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Abrir fila de atendimento
                </button>
              </div>
            </div>

            <div>
              <SecaoLabel>Balcão de Atendimento</SecaoLabel>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <AcaoRapidaCard
                  icon={<Printer className="h-5 w-5" />}
                  label="Imprimir Turma"
                  sublabel="Mapas e Pautas"
                  onClick={() => setBalcaoModal("turma_docs")}
                />
                <AcaoRapidaCard
                  icon={<Banknote className="h-5 w-5" />}
                  label="Cobrar Propina"
                  sublabel="Pagamento imediato"
                  onClick={() => setBalcaoModal("cobranca")}
                />
                <AcaoRapidaCard
                  icon={<FileText className="h-5 w-5" />}
                  label="Emitir Declaração"
                  sublabel="Documento oficial"
                  onClick={() => setBalcaoModal("documentos")}
                />
                <AcaoRapidaCard
                  icon={<UserPlus className="h-5 w-5" />}
                  label="Matricular"
                  sublabel="Novo ou confirmação"
                  onClick={() => setBalcaoModal("matricular")}
                />
                <AcaoRapidaCard
                  icon={<CalendarX className="h-5 w-5" />}
                  label="Justificar Falta"
                  sublabel="Registrar ausência"
                  onClick={() => setBalcaoModal("faltas")}
                />
                <AcaoRapidaCard
                  icon={<FileEdit className="h-5 w-5" />}
                  label="Lançar Nota"
                  sublabel="Abrir pauta"
                  onClick={() => setBalcaoModal("notas")}
                />
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {escolaId && (
                  <MinhaProdutividade 
                    key={refreshKey}
                    escolaId={escolaId} 
                    onData={handleProdutividadeData} 
                    onAtenderAluno={(alunoId) => {
                       setSelectedAlunoIdForBalcao(alunoId);
                       setBalcaoModal("atendimento_aluno");
                    }}
                  />
                )}

                <div>
                  <SecaoLabel>Gestão</SecaoLabel>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <AcaoRapidaCard icon={<Users className="h-5 w-5" />} label="Alunos" href={buildPortalHref(escolaParam, "/secretaria/alunos")} />
                    <AcaoRapidaCard
                      icon={<UserCheck className="h-5 w-5" />}
                      label="Professores"
                      href={buildPortalHref(escolaParam, "/secretaria/professores")}
                    />
                    <AcaoRapidaCard icon={<Building className="h-5 w-5" />} label="Turmas" href={buildPortalHref(escolaParam, "/secretaria/turmas")} />
                    <AcaoRapidaCard
                      icon={<RefreshCcw className="h-5 w-5" />}
                      label="Rematrículas"
                      href={buildPortalHref(escolaParam, "/secretaria/rematricula")}
                    />
                    <AcaoRapidaCard
                      icon={<KeyRound className="h-5 w-5" />}
                      label="Acesso Alunos"
                      href={buildPortalHref(escolaParam, "/secretaria/acesso-alunos")}
                    />
                    <AcaoRapidaCard
                      icon={<Upload size={20} className="text-klasse-green-600" />}
                      label="Migração"
                      href={buildPortalHref(escolaParam, "/secretaria/migracao/alunos")}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <SecaoLabel>Avisos gerais</SecaoLabel>
                  <div className="mt-4">
                    <NoticePanel 
                      items={avisos} 
                      showHeader={false} 
                      onAction={handleNoticeAction} 
                      onSnooze={refreshProdutividade}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {selectedAlunoIdForFicha && (
        <FichaRapidaModal 
          alunoId={selectedAlunoIdForFicha}
          onClose={() => setSelectedAlunoIdForFicha(null)}
          onSuccess={() => {
             // Opcional: recarregar dados ou apenas deixar o aviso sumir no próximo refresh
          }}
        />
      )}

      <ModalShell
        open={balcaoModal === "turma_docs"}
        title="Central de Documentos"
        description="Emissão rápida de mapas, pautas e listas nominais por turma."
        onClose={() => setBalcaoModal(null)}
      >
        <QuickDocHub escolaId={escolaId} />
      </ModalShell>

      <FilaAtendimentoModal open={filaOpen} onClose={() => setFilaOpen(false)} />
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
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Abrir admissões completas
              </Link>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Escola não identificada.</div>
        )}
      </ModalShell>

      <div className={balcaoModal === "atendimento_aluno" ? "block" : "hidden"}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => {
            setBalcaoModal(null);
            setSelectedAlunoIdForBalcao(null);
          }} />
          <div className="relative flex w-full max-w-6xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl">
             <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur flex items-center justify-between">
                <div>
                   <h2 className="text-lg font-bold text-slate-900">Atendimento ao Aluno</h2>
                   <p className="text-xs text-slate-500">Gestão financeira e documental rápida.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBalcaoModal(null);
                    setSelectedAlunoIdForBalcao(null);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
             </header>
             <div className="flex-1 overflow-y-auto p-6">
                {escolaId && selectedAlunoIdForBalcao ? (
                  <BalcaoAtendimento 
                    escolaId={escolaId} 
                    selectedAlunoId={selectedAlunoIdForBalcao}
                    showSearch={false}
                    embedded
                  />
                ) : (
                  <div className="p-12 text-center text-slate-500">
                    Nenhum aluno selecionado ou escola inválida.
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
      <ModalShell
        open={balcaoModal === "documentos"}
        title="Emitir declaração"
        description="Selecione o aluno e o tipo de documento."
        onClose={() => setBalcaoModal(null)}
      >
        {escolaId ? (
          <DocumentosEmissaoHubClient escolaId={escolaId} />
        ) : (
          <div className="text-sm text-slate-500">Escola não identificada.</div>
        )}
      </ModalShell>
      <ModalShell
        open={balcaoModal === "cobranca"}
        title="Cobrar propina"
        description="Busque o aluno e finalize o pagamento."
        onClose={() => setBalcaoModal(null)}
      >
        <div className="space-y-3">
          <BuscaBalcaoRapido escolaId={escolaId} />
          <p className="text-xs text-slate-500">
            Use a busca rápida para localizar o aluno e registrar o pagamento.
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
