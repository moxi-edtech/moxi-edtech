// apps/web/src/components/layout/escola-admin/QuickActionsSection.tsx
"use client";

import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ModalShell } from "@/components/ui/ModalShell";
import { HorarioDataProvider } from "@/components/escola/horarios/HorarioDataProvider";
import { Button } from "@/components/ui/Button";
import { PlusCircle, UserPlus, FileText, Megaphone, Calendar, Table2, Wallet, ClipboardCheck } from "lucide-react";
import type { SetupStatus } from "./setupStatus";
import AvisosNovoPage from "@/app/escola/[id]/(portal)/admin/avisos/novo/page";
import EventosPage from "@/app/escola/[id]/(portal)/eventos/page";
import NovoFuncionarioPage from "@/app/escola/[id]/(portal)/funcionarios/novo/page";
import FuncionariosPage from "@/app/escola/[id]/(portal)/funcionarios/page";
import ProfessoresPage from "@/app/escola/[id]/(portal)/professores/page";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import ExpedienteDashboardCard from "@/components/secretaria/ExpedienteDashboardCard";
import SecaoLabel from "@/components/shared/SecaoLabel";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const ProvasModal = dynamic(() => import("@/components/provas/ProvasModal"), {ssr:false});
const RecebimentosWorkspace = dynamic(() => import("@/components/financeiro/FilaValidacaoPagamentos").then(m => m.FilaValidacaoPagamentos), { ssr: false, loading: () => <WorkspaceLoading /> });
const HorarioWorkspace = dynamic(() => import("@/components/escola/horarios/HorarioEditor").then(m => m.HorarioEditor), { ssr: false, loading: () => <WorkspaceLoading /> });

function WorkspaceLoading() {
  return <div role="status" aria-label="A carregar" className="h-40 rounded-xl bg-muted motion-safe:animate-pulse" />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickAction = {
  key:      "funcionario" | "nota" | "aviso" | "evento" | "migracao_pautas" | "recebimentos" | "importacoes" | "horarios" | "criar_aviso" | "provas";
  label:    string;
  href:     string;
  icon:     React.ElementType;
  disabled?: boolean;
  reason?:  string;
  opensModal?: boolean;
  variant?: "green" | "yellow";
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickActionsSection({
  escolaId,
  setupStatus,
  portalBase = "admin",
}: {
  escolaId:    string;
  setupStatus: SetupStatus;
  portalBase?: "admin" | "operacoes";
}) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const { anoLetivoOk, avaliacaoFrequenciaOk, turmasOk } = setupStatus;
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [closeWarning, setCloseWarning] = useState(false);
  const closeGuardRef = useRef<(() => boolean) | null>(null);
  const actionTriggerRef = useRef<HTMLElement | null>(null);
  const operationalModal = selectedAction?.key === "recebimentos" || selectedAction?.key === "horarios";
  const launchAction = (action: QuickAction) => {
    actionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCloseWarning(false);
    setSelectedAction(action);
  };
  const closeOperationalModal = () => {
    if (closeGuardRef.current?.()) { setCloseWarning(true); return; }
    setCloseWarning(false);
    setSelectedAction(null);
    window.requestAnimationFrame(() => actionTriggerRef.current?.focus({preventScroll:true}));
  };

  const canLaunchNota = avaliacaoFrequenciaOk && turmasOk;

  const actions: QuickAction[] = portalBase === "operacoes"
    ? [
        {
          key: "recebimentos",
          label: "Recebimentos",
          opensModal: true,
          icon: Wallet,
          href: buildPortalHref(escolaParam, "/operacoes/recebimentos"),
          variant: "green",
        },
        {
          key: "horarios",
          label: "Quadro de Horários",
          opensModal: true,
          icon: Table2,
          href: buildPortalHref(escolaParam, "/operacoes/horarios/quadro"),
          disabled: !turmasOk,
          reason: "Crie turmas antes de gerir horários.",
          variant: "yellow",
        },
        {
          key: "provas",
          label: "Central de provas",
          opensModal: true,
          icon: ClipboardCheck,
          href: buildPortalHref(escolaParam, "/operacoes/provas"),
        },
        {
          key: "criar_aviso",
          label: "Criar Aviso",
          icon: Megaphone,
          href: buildPortalHref(escolaParam, "/operacoes/avisos/novo"),
          variant: "yellow",
        },
      ]
    : [
        {
          key: "provas",
          label: "Central de provas",
          icon: ClipboardCheck,
          opensModal: true,
          href: buildPortalHref(escolaParam, "/operacoes/provas"),
        },
        {
          key: "funcionario",
          label: "Novo Funcionário",
          icon:  UserPlus,
          href:  buildPortalHref(escolaParam, "/admin/funcionarios/novo"),
          opensModal: true,
          variant: "green",
        },
        {
          key: "nota",
          label:    "Lançar Nota",
          icon:     FileText,
          href:     buildPortalHref(escolaParam, "/admin/notas"),
          opensModal: true,
          disabled: !canLaunchNota,
          reason:   !avaliacaoFrequenciaOk
            ? "Configure avaliação e frequência primeiro."
            : "Crie turmas antes de lançar notas.",
          variant: "green",
        },
        {
          key: "aviso",
          label: "Criar Aviso",
          icon:  Megaphone,
          href:  buildPortalHref(escolaParam, "/admin/avisos/novo"),
          opensModal: true,
          variant: "yellow",
        },
        {
          key: "evento",
          label: "Agendar Evento",
          icon:  Calendar,
          href:  buildPortalHref(escolaParam, "/admin/calendario/novo"),
          opensModal: true,
          variant: "yellow",
        },
        {
          key: "migracao_pautas",
          label: "Migrar Pautas",
          icon: Table2,
          href: buildPortalHref(escolaParam, "/admin/migracao/pautas"),
          disabled: !turmasOk,
          reason: "Crie turmas antes de usar a migração de pautas.",
          variant: "yellow",
        },
      ];

  const renderSheetBody = () => {
    if (!selectedAction) return null;
    switch (selectedAction.key) {
      case "funcionario":
        return <CadastroColaboradoresBody allowProfessor={anoLetivoOk} />;
      case "aviso":
        return <AvisosNovoPage />;
      case "evento":
        return <EventosPage />;
      case "nota":
        return (
          <div className="py-6 space-y-4">
            <p className="text-sm text-foreground/80">
              A gestão completa de notas fica disponível na página dedicada. Abra para lançar,
              revisar e exportar notas com todos os filtros.
            </p>
            <Link
              href={buildPortalHref(escolaParam, "/admin/notas")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald px-4 py-2 text-sm font-semibold text-white hover:brightness-95 transition-all shadow-md shadow-emerald/20"
            >
              Abrir Painel de Notas
            </Link>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className={portalBase === "operacoes" ? "min-w-0" : "rounded-xl border border-border bg-card p-5 shadow-sm"}>
      {portalBase === "operacoes" ? <h2 className="mb-4 text-base font-semibold text-foreground">Ações rápidas</h2> : <header className="mb-5">
        <SecaoLabel className="text-emerald">Atalhos do portal</SecaoLabel>
        <div className="mt-1 flex items-center gap-2.5">
          <div className="rounded-lg bg-emerald/10 p-2 text-emerald">
            <PlusCircle className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Ações rápidas</h3>
        </div>
      </header>}

      <div className={portalBase === "operacoes" ? "operations-actions-grid grid" : "grid grid-cols-2 gap-3 sm:grid-cols-3 min-[1280px]:grid-cols-5"}>
        <ExpedienteDashboardCard escolaId={escolaId} portal={portalBase} />
        {actions.map((action) => (
          <AcaoRapidaCard
            key={action.key}
            icon={<action.icon className="h-5 w-5" />}
            label={action.label}
            onClick={action.opensModal ? () => launchAction(action) : undefined}
            dialogOpen={action.opensModal ? selectedAction?.key === action.key : undefined}
            href={!action.opensModal ? action.href : undefined}
            disabled={action.disabled}
            disabledReason={action.reason}
            dashboardCompact={portalBase === "operacoes"}
            variant={action.variant}
          />
        ))}
      </div>

      <ModalShell open={Boolean(operationalModal)} size="wide"
        title={selectedAction?.key === "horarios" ? "Quadro de horários" : "Recebimentos"}
        description={selectedAction?.key === "horarios" ? "Seleccione uma turma para gerir, validar e publicar o horário." : "Conferência e validação de propinas, taxas e serviços."}
        onClose={closeOperationalModal}
        footer={closeWarning ? <div role="status" className="flex items-center justify-between gap-3 text-sm"><p>Conclua ou cancele a operação aberta antes de fechar.</p><Button type="button" variant="outline" onClick={() => setCloseWarning(false)}>Continuar</Button></div> : undefined}>
        {selectedAction?.key === "recebimentos" && <RecebimentosWorkspace key={escolaId} escolaId={escolaId} closeGuardRef={closeGuardRef} />}
        {selectedAction?.key === "horarios" && <Suspense fallback={<WorkspaceLoading />}><HorarioDataProvider key={escolaId} escolaId={escolaId}><HorarioWorkspace escolaId={escolaId} dashboardModal closeGuardRef={closeGuardRef} /></HorarioDataProvider></Suspense>}
      </ModalShell>

      {selectedAction?.key === "provas" && <ProvasModal escolaId={escolaId} onClose={closeOperationalModal} />}
      <Sheet open={!!selectedAction && !operationalModal && selectedAction.key !== "provas"} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <SheetContent side="right" className="sm:max-w-3xl overflow-y-auto scrollbar-hide">
          <SheetHeader className="border-b border-border pb-4 mb-4">
            <SheetTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              {selectedAction?.icon && <selectedAction.icon className="h-5 w-5 text-emerald" />}
              {selectedAction?.label}
            </SheetTitle>
            <SheetDescription>
              Execute ações operacionais rapidamente sem sair do seu cockpit.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {renderSheetBody()}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CadastroColaboradoresBody({ allowProfessor }: { allowProfessor: boolean }) {
  const [tab, setTab] = useState<"funcionario" | "professor">("funcionario");
  const [funcionarioTab, setFuncionarioTab] = useState<"listar" | "cadastrar">("listar");
  
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted p-4">
        <h4 className="text-sm font-bold text-foreground mb-1">Tipo de Colaborador</h4>
        <div className="inline-flex rounded-xl bg-card p-1 shadow-sm ring-1 ring-ring">
          <button
            type="button"
            onClick={() => setTab("funcionario")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === "funcionario" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Funcionário
          </button>
          <button
            type="button"
            onClick={() => allowProfessor && setTab("professor")}
            disabled={!allowProfessor}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === "professor" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
            } ${!allowProfessor ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            Professor
          </button>
        </div>
      </div>

      {tab === "funcionario" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setFuncionarioTab("listar")}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  funcionarioTab === "listar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Listagem
              </button>
              <button
                type="button"
                onClick={() => setFuncionarioTab("cadastrar")}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  funcionarioTab === "cadastrar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Novo Cadastro
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-1">
            {funcionarioTab === "listar" ? <FuncionariosPage embedded /> : <NovoFuncionarioPage embedded />}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <ProfessoresPage />
        </div>
      )}
    </div>
  );
}
