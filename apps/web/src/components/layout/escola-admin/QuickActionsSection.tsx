// apps/web/src/components/layout/escola-admin/QuickActionsSection.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { PlusCircle, UserPlus, Users, FileText, Megaphone, Calendar, Lock, X } from "lucide-react";
import type { SetupStatus } from "./setupStatus";
import AvisosNovoPage from "@/app/escola/[id]/admin/avisos/novo/page";
import EventosPage from "@/app/escola/[id]/eventos/page";
import NovoFuncionarioPage from "@/app/escola/[id]/funcionarios/novo/page";
import FuncionariosPage from "@/app/escola/[id]/funcionarios/page";
import ProfessoresPage from "@/app/escola/[id]/professores/page";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickAction = {
  key:      "funcionario" | "nota" | "aviso" | "evento";
  label:    string;
  href:     string;
  icon:     React.ElementType;
  disabled?: boolean;
  reason?:  string; // shown when disabled — explains *why*, not just "Bloqueado"
  opensModal?: boolean;
};

// ─── Action card ──────────────────────────────────────────────────────────────
// Disabled actions render as a plain div (no <Link>) to prevent navigation
// via keyboard, middle-click, or direct URL access.

function ActionCard({ action, onOpen }: { action: QuickAction; onOpen?: (action: QuickAction) => void }) {
  const Icon = action.icon;
  const inner = (
    <div className="relative group flex flex-col items-center justify-center gap-2.5 rounded-xl border px-2 py-5 transition-all bg-slate-50 border-slate-100 hover:bg-white hover:border-[#1F6B3B]/30 hover:shadow-md">
      {/* Icon circle */}
      <div className={`
        flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-1 transition-all
        ${action.disabled
          ? "bg-slate-100 text-slate-300 ring-slate-200"
          : "bg-white text-slate-500 ring-slate-200 group-hover:text-[#1F6B3B] group-hover:ring-[#1F6B3B]/20"
        }
      `}>
        {action.disabled ? <Lock className="h-4 w-4" /> : <Icon className="h-5 w-5" />}
      </div>

      {/* Label */}
      <span className={`
        w-full text-center text-xs font-semibold leading-tight line-clamp-2
        ${action.disabled ? "text-slate-400" : "text-slate-700"}
      `}>
        {action.label}
      </span>

      {/* Reason tooltip on hover — visible only when disabled */}
      {action.disabled && action.reason && (
        <div className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 z-10
          bg-slate-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 text-center
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150
          shadow-lg
        ">
          {action.reason}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );

  if (action.disabled) {
    return <div className="cursor-not-allowed">{inner}</div>;
  }

  if (action.opensModal && onOpen) {
    return (
      <button type="button" onClick={() => onOpen(action)} className="block text-left">
        {inner}
      </button>
    );
  }

  return (
    <Link href={action.href} className="block">
      {inner}
    </Link>
  );
}

function QuickActionModal({
  action,
  onClose,
  escolaId,
  allowProfessor,
}: {
  action: QuickAction | null;
  onClose: () => void;
  escolaId: string;
  allowProfessor: boolean;
}) {
  if (!action) return null;
  const renderBody = () => {
    switch (action.key) {
      case "funcionario":
        return <CadastroColaboradoresModal allowProfessor={allowProfessor} />;
      case "aviso":
        return <AvisosNovoPage />;
      case "evento":
        return <EventosPage />;
      case "nota":
        return (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Lançar notas</h2>
            <p className="text-sm text-slate-600">
              A gestão completa de notas fica disponível na página dedicada. Abra para lançar,
              revisar e exportar notas com todos os filtros.
            </p>
            <Link
              href={`/escola/${escolaId}/admin/notas`}
              className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
            >
              Abrir notas
            </Link>
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl h-[85vh] rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <action.icon className="h-4 w-4 text-slate-500" />
            {action.label}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-full w-full overflow-auto">
          {renderBody()}
        </div>
      </div>
    </div>
  );
}

function CadastroColaboradoresModal({ allowProfessor }: { allowProfessor: boolean }) {
  const [tab, setTab] = useState<"funcionario" | "professor">("funcionario");
  const [funcionarioTab, setFuncionarioTab] = useState<"listar" | "cadastrar">("listar");
  return (
    <div className="h-full overflow-auto">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Cadastro de colaboradores</h2>
        <p className="text-sm text-slate-500">
          Escolha o tipo de cadastro e preencha o formulário correspondente.
        </p>
        <div className="mt-4 inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setTab("funcionario")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === "funcionario" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Funcionário
          </button>
          <button
            type="button"
            onClick={() => allowProfessor && setTab("professor")}
            disabled={!allowProfessor}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === "professor" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            } ${!allowProfessor ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Professor
          </button>
        </div>
      </div>
      <div className="p-6">
        {tab === "funcionario" ? (
          <div className="space-y-6">
            <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setFuncionarioTab("listar")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  funcionarioTab === "listar" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Funcionários
              </button>
              <button
                type="button"
                onClick={() => setFuncionarioTab("cadastrar")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  funcionarioTab === "cadastrar" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cadastrar
              </button>
            </div>
            {funcionarioTab === "listar" ? <FuncionariosPage embedded /> : <NovoFuncionarioPage embedded />}
          </div>
        ) : (
          <ProfessoresPage />
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickActionsSection({
  escolaId,
  setupStatus,
}: {
  escolaId:    string;
  setupStatus: SetupStatus;
}) {
  const { anoLetivoOk, avaliacaoFrequenciaOk, turmasOk } = setupStatus;
  const [modalAction, setModalAction] = useState<QuickAction | null>(null);

  const canLaunchNota      = avaliacaoFrequenciaOk && turmasOk;

  const actions: QuickAction[] = [
    {
      key: "funcionario",
      label: "Novo Funcionário",
      icon:  UserPlus,
      href:  `/escola/${escolaId}/admin/funcionarios/novo`,
      opensModal: true,
    },
    {
      key: "nota",
      label:    "Lançar Nota",
      icon:     FileText,
      href:     `/escola/${escolaId}/admin/notas`,
      opensModal: true,
      disabled: !canLaunchNota,
      reason:   !avaliacaoFrequenciaOk
        ? "Configure avaliação e frequência primeiro."
        : "Crie turmas antes de lançar notas.",
    },
    {
      key: "aviso",
      label: "Criar Aviso",
      icon:  Megaphone,
      href:  `/escola/${escolaId}/admin/avisos/novo`,
      opensModal: true,
    },
    {
      key: "evento",
      label: "Agendar Evento",
      icon:  Calendar,
      href:  `/escola/${escolaId}/admin/calendario/novo`,
      opensModal: true,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-5 flex items-center gap-2.5">
        <div className="rounded-xl bg-slate-100 p-2 text-slate-500">
          <PlusCircle className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Ações Rápidas</h3>
      </header>

      {/* 
        5 items: 2 cols on mobile → 3 on sm → 5 on lg.
        sm:grid-cols-3 leaves an orphan on small screens intentionally —
        the 2-col fallback on xs avoids it entirely.
      */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => (
          <ActionCard key={action.href} action={action} onOpen={setModalAction} />
        ))}
      </div>
      <QuickActionModal
        action={modalAction}
        onClose={() => setModalAction(null)}
        escolaId={escolaId}
        allowProfessor={anoLetivoOk}
      />
    </section>
  );
}
