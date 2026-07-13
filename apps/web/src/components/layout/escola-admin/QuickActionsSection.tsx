// apps/web/src/components/layout/escola-admin/QuickActionsSection.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { PlusCircle, UserPlus, FileText, Megaphone, Calendar, Table2, Wallet, UploadCloud } from "lucide-react";
import type { SetupStatus } from "./setupStatus";
import AvisosNovoPage from "@/app/escola/[id]/(portal)/admin/avisos/novo/page";
import EventosPage from "@/app/escola/[id]/(portal)/eventos/page";
import NovoFuncionarioPage from "@/app/escola/[id]/(portal)/funcionarios/novo/page";
import FuncionariosPage from "@/app/escola/[id]/(portal)/funcionarios/page";
import ProfessoresPage from "@/app/escola/[id]/(portal)/professores/page";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickAction = {
  key:      "funcionario" | "nota" | "aviso" | "evento" | "migracao_pautas" | "recebimentos" | "importacoes";
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

  const canLaunchNota = avaliacaoFrequenciaOk && turmasOk;

  const actions: QuickAction[] = portalBase === "operacoes"
    ? [
        {
          key: "funcionario",
          label: "Nova Matrícula",
          icon: UserPlus,
          href: buildPortalHref(escolaParam, "/operacoes/matriculas/nova"),
          variant: "green",
        },
        {
          key: "nota",
          label: "Nova Admissão",
          icon: FileText,
          href: buildPortalHref(escolaParam, "/operacoes/admissoes/nova"),
          variant: "green",
        },
        {
          key: "aviso",
          label: "Importar Alunos",
          icon: UploadCloud,
          href: buildPortalHref(escolaParam, "/operacoes/importacoes"),
          variant: "green",
        },
        {
          key: "evento",
          label: "Recebimentos",
          icon: Wallet,
          href: buildPortalHref(escolaParam, "/operacoes/recebimentos"),
          variant: "green",
        },
        {
          key: "migracao_pautas",
          label: "Quadro de Horários",
          icon: Table2,
          href: buildPortalHref(escolaParam, "/operacoes/horarios/quadro"),
          disabled: !turmasOk,
          reason: "Crie turmas antes de gerir horários.",
          variant: "yellow",
        },
        {
          key: "recebimentos",
          label: "Criar Aviso",
          icon: Megaphone,
          href: buildPortalHref(escolaParam, "/operacoes/avisos/novo"),
          variant: "yellow",
        },
      ]
    : [
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
            <p className="text-sm text-slate-600">
              A gestão completa de notas fica disponível na página dedicada. Abra para lançar,
              revisar e exportar notas com todos os filtros.
            </p>
            <Link
              href={buildPortalHref(escolaParam, "/admin/notas")}
              className="inline-flex items-center gap-2 rounded-xl bg-klasse-green px-4 py-2 text-sm font-semibold text-white hover:brightness-95 transition-all shadow-md shadow-klasse-green/20"
            >
              Abrir Painel de Notas
            </Link>
          </div>
        );
      default:
        return null;
    }
  };

  const isOperacoes = portalBase === "operacoes";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <header className="mb-5 flex items-center gap-2.5">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
          <PlusCircle className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Ações Rápidas</h3>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => (
          <AcaoRapidaCard
            key={action.key}
            icon={<action.icon className="h-5 w-5" />}
            label={action.label}
            onClick={() => action.opensModal && setSelectedAction(action)}
            href={!action.opensModal ? action.href : undefined}
            disabled={action.disabled}
            disabledReason={action.reason}
            compact={isOperacoes}
            variant={action.variant}
          />
        ))}
      </div>

      <Sheet open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <SheetContent side="right" className="sm:max-w-3xl overflow-y-auto scrollbar-hide">
          <SheetHeader className="border-b border-slate-100 pb-4 mb-4">
            <SheetTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              {selectedAction?.icon && <selectedAction.icon className="h-5 w-5 text-klasse-green" />}
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-bold text-slate-900 mb-1">Tipo de Colaborador</h4>
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setTab("funcionario")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === "funcionario" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Funcionário
          </button>
          <button
            type="button"
            onClick={() => allowProfessor && setTab("professor")}
            disabled={!allowProfessor}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === "professor" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
            } ${!allowProfessor ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            Professor
          </button>
        </div>
      </div>

      {tab === "funcionario" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setFuncionarioTab("listar")}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  funcionarioTab === "listar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Listagem
              </button>
              <button
                type="button"
                onClick={() => setFuncionarioTab("cadastrar")}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  funcionarioTab === "cadastrar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Novo Cadastro
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-1">
            {funcionarioTab === "listar" ? <FuncionariosPage embedded /> : <NovoFuncionarioPage embedded />}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-white">
          <ProfessoresPage />
        </div>
      )}
    </div>
  );
}
