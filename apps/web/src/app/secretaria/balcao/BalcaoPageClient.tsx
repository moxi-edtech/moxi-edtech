"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import AcademicYearSelector from "@/components/academic/AcademicYearSelector";
import BalcaoAtendimento, { type AlunoDossier } from "@/components/secretaria/BalcaoAtendimento";
import { CommandCenterPanel } from "@/components/secretaria/command-center/CommandCenterPanel";
import { RetainedActionPanels } from "@/components/secretaria/command-center/RetainedActionPanels";
import { CommandCenterShell } from "@/components/secretaria/command-center/CommandCenterShell";
import { useCommandCenterStudent } from "@/components/secretaria/command-center/useCommandCenterStudent";
import { ResumoCaixaSecretaria } from "@/components/secretaria/ResumoCaixaSecretaria";
import {
  BALCAO_ACTION_REGISTRY,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { readBalcaoStudentId, setBalcaoLocationContext } from "@/lib/balcao/return-context";

function parseAction(value: string | null): BalcaoActionId {
  return value && value in BALCAO_ACTION_REGISTRY
    ? value as BalcaoActionId
    : "desk";
}

export default function BalcaoPageClient({
  escolaId,
  escolaParam,
  profileAlunoId,
  profileDossier,
  userScope,
}: {
  escolaId: string;
  escolaParam: string;
  profileAlunoId: string | null;
  profileDossier: ReactNode;
  userScope: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM) ?? null;
  const queryAction = parseAction(searchParams?.get("action") ?? null);
  const locationStudentId = readBalcaoStudentId(new URLSearchParams(searchParams?.toString() ?? ""), queryAction);
  const returnToParam = searchParams?.get("returnTo") ?? null;
  const returnTo = returnToParam?.startsWith("/") && !returnToParam.startsWith("//")
    ? returnToParam
    : null;

  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(locationStudentId);
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(queryAction);
  const [caixaRefreshKey, setCaixaRefreshKey] = useState(0);
  const [atendimentoKey, setAtendimentoKey] = useState(0);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const unsavedWorkRef = useRef(false);
  const handleUnsavedChange = useCallback((value: boolean) => { unsavedWorkRef.current = value; }, []);
  const {
    student: commandCenterStudent,
    setStudent: setCommandCenterStudent,
    subtitle: commandCenterSubtitle,
  } = useCommandCenterStudent(selectedAlunoId, academicYearId);

  useEffect(() => {
    setSelectedAlunoId(locationStudentId);
  }, [locationStudentId]);

  useEffect(() => {
    setActiveAction(queryAction);
  }, [queryAction]);

  const aoConcluirPagamento = useCallback(
    () => setCaixaRefreshKey((current) => current + 1),
    [],
  );

  const syncLocation = useCallback((params: {
    alunoId?: string | null;
    actionId?: BalcaoActionId;
  }) => {
    const nextAlunoId = params.alunoId === undefined ? selectedAlunoId : params.alunoId;
    const nextAction = params.actionId ?? activeAction;
    const next = setBalcaoLocationContext(
      new URLSearchParams(searchParams?.toString() ?? ""),
      nextAlunoId,
      nextAction,
    );

    const query = next.toString();
    const targetPath = pathname || "/secretaria/balcao";
    router.replace(query ? `${targetPath}?${query}` : targetPath, { scroll: false });
  }, [activeAction, pathname, router, searchParams, selectedAlunoId]);

  const handleCommandCenterSuccess = useCallback((newAlunoId?: string) => {
    setCaixaRefreshKey((current) => current + 1);
    setRefreshRevision((value) => value + 1);
    if (!newAlunoId) return;

    // Matrícula confirmada: o aluno recém-criado passa a ser o atendimento.
    setSelectedAlunoId(newAlunoId);
    setActiveAction("desk");
    syncLocation({ alunoId: newAlunoId, actionId: "desk" });
  }, [syncLocation]);

  const handleActionChange = useCallback((actionId: BalcaoActionId) => {
    if (actionId === activeAction) return;
    if (
      activeAction === "enrollment" &&
      !window.confirm("Sair da nova matrícula? Alterações ainda não guardadas poderão perder-se. O aluno anterior continuará selecionado.")
    ) return;

    // Ao entrar na Matrícula, preservamos o atendimento para regressar,
    // sem apresentar esse aluno como o destinatário da nova inscrição.
    setActiveAction(actionId);
    syncLocation({ alunoId: selectedAlunoId, actionId });
  }, [activeAction, selectedAlunoId, syncLocation]);

  const handleSwitchStudent = useCallback(() => {
    // Este aviso protege a transição entre módulos. Ações já submetidas
    // continuam sob a autoridade do backend; não declarar sucesso localmente.
    if ((activeAction !== "desk" || unsavedWorkRef.current) && !window.confirm(
      "Quer trocar de aluno? Dados ainda não guardados neste atendimento poderão perder-se."
    )) return;

    unsavedWorkRef.current = false;
    setAtendimentoKey((key) => key + 1);
    setSelectedAlunoId(null);
    setCommandCenterStudent(null);
    setActiveAction("desk");
    syncLocation({ alunoId: null, actionId: "desk" });
  }, [activeAction, setCommandCenterStudent, syncLocation]);

  const handleAlunoSelected = useCallback((aluno: AlunoDossier | null) => {
    const nextAlunoId = aluno?.id ?? null;
    setSelectedAlunoId(nextAlunoId);
    if (!aluno) {
      setCommandCenterStudent(null);
      setActiveAction("desk");
      syncLocation({ alunoId: null, actionId: "desk" });
      return;
    }

    setCommandCenterStudent({
      id: aluno.id,
      label: aluno.nome,
      numeroProcesso: aluno.numero_processo,
      classe: aluno.classe ?? null,
      turma: aluno.turma_codigo ?? null,
      turmaId: aluno.turma_id ?? null,
    });
    syncLocation({ alunoId: nextAlunoId });
  }, [setCommandCenterStudent, syncLocation]);

  return (
    <CommandCenterShell
      variant="page"
      student={commandCenterStudent ? {
        id: commandCenterStudent.id,
        label: commandCenterStudent.label,
        subtitle: commandCenterSubtitle,
      } : null}
      activeAction={activeAction}
      onActionChange={handleActionChange}
      onSwitchStudent={handleSwitchStudent}
      leading={
        <Link
          href={`/escola/${escolaParam}/secretaria`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Voltar à Secretaria"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      }
      trailing={<AcademicYearSelector escolaId={escolaId} />}
    >
      <ResumoCaixaSecretaria escolaId={escolaId} refreshKey={caixaRefreshKey} />

      <section className="mt-4 min-w-0 pb-2">
        {selectedAlunoId || activeAction === "enrollment" ? (
          <RetainedActionPanels
            key={`${userScope}:${escolaId}:${searchParams?.get("polo_id") ?? "-"}:${selectedAlunoId ?? "-"}:${atendimentoKey}`}
            activeAction={activeAction}
            contextSignature={`${userScope}:${escolaId}:${selectedAlunoId ?? "-"}:${commandCenterStudent?.turmaId ?? "-"}:${refreshRevision}`}
            onUnsavedChange={handleUnsavedChange}
            renderAction={(panelAction) => (
              <CommandCenterPanel
                escolaId={escolaId}
                draftScope={`${userScope}:${searchParams?.get("polo_id") ?? "-"}`}
                alunoId={panelAction === "enrollment" ? null : selectedAlunoId}
                turmaId={commandCenterStudent?.turmaId ?? null}
                turmaLabel={commandCenterStudent?.turma ?? null}
                actionId={panelAction}
                visible={panelAction === activeAction}
                refreshRevision={refreshRevision}
                profileDossier={panelAction === "profile" && selectedAlunoId === profileAlunoId ? profileDossier : null}
                returnTo={returnTo}
                onActionChange={handleActionChange}
                onAlunoSelected={panelAction === activeAction ? (aluno) => {
                  // An inactive/loading panel must never clear another action's student.
                  if (aluno?.id) handleAlunoSelected(aluno);
                } : undefined}
                onSuccess={handleCommandCenterSuccess}
              />
            )}
          />
        ) : (
          <BalcaoAtendimento
            key={`search-${atendimentoKey}`}
            escolaId={escolaId}
            selectedAlunoId={null}
            showSearch
            embedded
            view="overview"
            onNavigateAction={handleActionChange}
            onAlunoSelected={handleAlunoSelected}
            onPagamentoConcluido={aoConcluirPagamento}
          />
        )}
      </section>
    </CommandCenterShell>
  );
}
