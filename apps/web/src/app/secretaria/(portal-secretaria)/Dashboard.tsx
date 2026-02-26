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
} from "lucide-react";
import { useMemo, useState } from "react";
import { useEscolaId } from "@/hooks/useEscolaId";
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
import type { DashboardCounts, DashboardRecentes } from "./types";

type BalcaoModal =
  | "matricular"
  | "documentos"
  | "cobranca"
  | "faltas"
  | "notas"
  | null;

export function Dashboard({
  counts,
  recentes,
}: {
  counts: DashboardCounts | null;
  recentes: DashboardRecentes | null;
}) {
  const { escolaId, isLoading: escolaLoading } = useEscolaId();
  const [filaOpen, setFilaOpen] = useState(false);
  const [balcaoModal, setBalcaoModal] = useState<BalcaoModal>(null);
  const avisoFechoTrimestre = useMemo(() => {
    const fecho = recentes?.fecho_trimestre;
    if (!fecho?.trava_notas_em) return null;
    const prazo = new Date(fecho.trava_notas_em);
    if (Number.isNaN(prazo.getTime())) return null;
    const diffMs = prazo.getTime() - Date.now();
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
      action_href: "/secretaria/notas",
    };
  }, [recentes?.fecho_trimestre]);
  const avisos = useMemo(() => {
    const base = recentes?.avisos_recentes ?? [];
    return avisoFechoTrimestre ? [avisoFechoTrimestre, ...base] : base;
  }, [avisoFechoTrimestre, recentes?.avisos_recentes]);
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
        link: "/secretaria/alertas",
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
        link: "/secretaria/avisos",
        link_label: "Abrir avisos",
      });
    }

    return items;
  }, [counts?.pendencias, recentes?.avisos_recentes?.length, recentes?.pendencias]);

  return (
    <div className="flex flex-col min-h-full bg-slate-50 font-sans text-slate-900">
      <div className="flex-1 flex">
        <main className="flex-1 p-6 lg:p-8 pb-32">
          <div className="max-w-5xl mx-auto space-y-8">
            <DashboardHeader
              title="Secretaria"
              description="Resumo operacional do dia"
              breadcrumbs={[
                { label: "Início", href: "/app" },
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
                    href="/secretaria/admissoes?nova=1"
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
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                <div className="flex items-center justify-between mb-4">
                  <SecaoLabel>Atenção Necessária</SecaoLabel>
                  <Link
                    href="/secretaria/admissoes"
                    className="text-xs font-semibold text-[#1F6B3B] hover:underline"
                  >
                    Ver tudo
                  </Link>
                </div>

                <TaskList items={recentes?.novas_matriculas ?? []} />

                <div>
                  <SecaoLabel>Gestão</SecaoLabel>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <AcaoRapidaCard icon={<Users className="h-5 w-5" />} label="Alunos" href="/secretaria/alunos" />
                    <AcaoRapidaCard
                      icon={<UserCheck className="h-5 w-5" />}
                      label="Professores"
                      href="/secretaria/professores"
                    />
                    <AcaoRapidaCard icon={<Building className="h-5 w-5" />} label="Turmas" href="/secretaria/turmas" />
                    <AcaoRapidaCard
                      icon={<RefreshCcw className="h-5 w-5" />}
                      label="Rematrículas"
                      href="/secretaria/rematricula"
                    />
                    <AcaoRapidaCard
                      icon={<KeyRound className="h-5 w-5" />}
                      label="Acesso Alunos"
                      href="/secretaria/acesso-alunos"
                    />
                    <AcaoRapidaCard
                      icon={<Upload className="h-5 w-5" />}
                      label="Migração"
                      href="/secretaria/migracao/alunos"
                    />
                    <AcaoRapidaCard
                      icon={<Users className="h-5 w-5" />}
                      label="Usuários Globais"
                      href="/secretaria/usuarios/globais"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <SecaoLabel>Avisos gerais</SecaoLabel>
                  <div className="mt-4">
                    <NoticePanel items={avisos} showHeader={false} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <FilaAtendimentoModal open={filaOpen} onClose={() => setFilaOpen(false)} />
      <ModalShell
        open={balcaoModal === "matricular"}
        title="Nova matrícula"
        description="Admissão rápida sem sair do dashboard."
        onClose={() => setBalcaoModal(null)}
      >
        {escolaId ? (
          <div className="space-y-4">
            <AdmissaoWizardClient escolaId={escolaId} />
            <Link
              href="/secretaria/admissoes"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Abrir admissões completas
            </Link>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Escola não identificada.</div>
        )}
      </ModalShell>
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
