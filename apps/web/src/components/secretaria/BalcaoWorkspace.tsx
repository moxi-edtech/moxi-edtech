"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CommandCenterPanel } from "@/components/secretaria/command-center/CommandCenterPanel";
import { useBalcaoTelemetry } from "@/components/secretaria/command-center/useBalcaoTelemetry";
import { RetainedActionPanels } from "@/components/secretaria/command-center/RetainedActionPanels";
import { useBalcaoKeyboardShortcuts } from "@/components/secretaria/command-center/useBalcaoKeyboardShortcuts";
import type { BalcaoDraftSummary } from "@/components/secretaria/command-center/BalcaoDraftState";
import { CommandCenterShell } from "@/components/secretaria/command-center/CommandCenterShell";
import { CommandCenterStudentPicker } from "@/components/secretaria/command-center/CommandCenterStudentPicker";
import { useCommandCenterStudent } from "@/components/secretaria/command-center/useCommandCenterStudent";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";

type Student = { id: string; label: string };

type Props = {
  open: boolean;
  escolaId: string;
  userScope?: string | null;
  poloScope?: string;
  aluno: Student;
  actionId?: BalcaoActionId;
  onClose: () => void;
  onSuccess?: () => void;
};

export function BalcaoWorkspace({
  open,
  escolaId,
  userScope,
  poloScope = "-",
  aluno,
  actionId = "desk",
  onClose,
  onSuccess,
}: Props) {
  // Selecionar "Nova matrícula" muda a operação, nunca o aluno em atendimento.
  const [selectedStudent, setSelectedStudent] = useState<Student>(aluno);
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(actionId);
  const { markNavigationStart } = useBalcaoTelemetry(activeAction);
  const [switchingStudent, setSwitchingStudent] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const { student: studentContext, subtitle } = useCommandCenterStudent(
    selectedStudent.id, academicYearId, selectedStudent.label,
  );
  const currentStudent = studentContext?.id === selectedStudent.id ? studentContext : null;
  const completedEnrollmentRef = useRef(false);
  const studentRequestRef = useRef(0);
  const hasUnsavedWorkRef = useRef(false);
  const submittingRef = useRef(false);
  const [actionDraftStatuses, setActionDraftStatuses] = useState<Readonly<Partial<Record<BalcaoActionId, BalcaoDraftSummary>>>>({});
  const handleActionDraftStatuses = useCallback((next: Readonly<Partial<Record<BalcaoActionId, BalcaoDraftSummary>>>) => {
    setActionDraftStatuses(next);
  }, []);
  const pendingActions = Object.entries(actionDraftStatuses)
    .filter(([, summary]) => summary?.dirty)
    .map(([action]) => action as BalcaoActionId);
  const handleUnsavedChange = useCallback((value: boolean) => { hasUnsavedWorkRef.current = value; }, []);
  const handleSubmittingChange = useCallback((value: boolean) => { submittingRef.current = value; }, []);

  useEffect(() => {
    setSelectedStudent(aluno);
    setActiveAction(actionId);
    completedEnrollmentRef.current = false;
    setSwitchingStudent(false);
    hasUnsavedWorkRef.current = false;
  }, [actionId, aluno.id, aluno.label]);

  useEffect(() => () => {
    studentRequestRef.current += 1;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setAcademicYearId(null);
    if (!open) return () => controller.abort();
    void fetch("/api/academic-context", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!controller.signal.aborted) setAcademicYearId(
          payload?.ok && typeof payload.context?.anoLetivoId === "string"
            ? payload.context.anoLetivoId : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setAcademicYearId(null);
      });
    return () => controller.abort();
  }, [escolaId, open]);

  const confirmLeavingEnrollment = useCallback(() => (
    activeAction !== "enrollment" || completedEnrollmentRef.current ||
    window.confirm("Sair da nova matrícula? Alterações ainda não guardadas poderão perder-se. O aluno anterior continuará selecionado.")
  ), [activeAction]);

  const handleActionChange = useCallback((next: BalcaoActionId) => {
    if (next === activeAction || !confirmLeavingEnrollment()) return;
    if (next === "enrollment") completedEnrollmentRef.current = false;
    markNavigationStart();
    setSwitchingStudent(false);
    setActiveAction(next);
  }, [activeAction, confirmLeavingEnrollment, markNavigationStart]);

  const handleSwitchStudent = useCallback(() => {
    if (submittingRef.current) return;
    // Opening the picker never discards work or changes the student.
    setSwitchingStudent(true);
  }, []);

  const handleStudentPicked = useCallback((next: Student) => {
    if (submittingRef.current) return;
    if (next.id === selectedStudent.id) {
      setSwitchingStudent(false);
      return;
    }
    // Confirm only when actually selecting another student. Cancelling the
    // picker never loses an unsaved grade, payment or enrollment draft.
    if (!window.confirm(
      "Trocar de aluno? As alterações ainda não guardadas poderão perder-se.",
    )) return;
    studentRequestRef.current += 1;
    completedEnrollmentRef.current = false;
    hasUnsavedWorkRef.current = false;
    setSelectedStudent(next);
    setActiveAction("desk"); // reset all student-bound panels and drafts
    setSwitchingStudent(false);
  }, [selectedStudent.id]);

  const handleClose = useCallback(() => {
    if (submittingRef.current) return;
    if (!confirmLeavingEnrollment()) return;
    if (activeAction !== "enrollment" && hasUnsavedWorkRef.current &&
      !window.confirm("Fechar atendimento? Existem alterações ainda não guardadas.")) return;
    onClose();
  }, [activeAction, confirmLeavingEnrollment, onClose]);

  const handleSuccess = useCallback((originAction: BalcaoActionId, newAlunoId?: string) => {
    setRefreshRevision((value) => value + 1);
    if (originAction === "enrollment" && newAlunoId) {
      completedEnrollmentRef.current = true;
      // Só depois do backend confirmar a matrícula mudamos para o aluno criado.
      setSelectedStudent({ id: newAlunoId, label: "Aluno matriculado" });
      setActiveAction("desk");
      const version = ++studentRequestRef.current;
      void fetch(`/api/secretaria/alunos/${encodeURIComponent(newAlunoId)}`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (version !== studentRequestRef.current || !payload?.ok || payload.item?.id !== newAlunoId) return;
          const label = payload.item.nome || payload.item.nome_completo;
          if (typeof label === "string" && label.trim()) {
            setSelectedStudent({ id: newAlunoId, label: label.trim() });
          }
        })
        .catch(() => {
          // O nome temporário é seguro; os restantes dados são carregados pelos painéis.
        });
    }
    onSuccess?.();
  }, [onSuccess]);

  const shortcuts = useBalcaoKeyboardShortcuts({
    onSearch: handleSwitchStudent,
    onSwitch: handleSwitchStudent, // never bypasses pending/submit guard
  });

  if (!open) return null;

  return (
    <CommandCenterShell
      variant="modal"
      student={{ ...selectedStudent, subtitle: currentStudent ? subtitle : null }}
      activeAction={activeAction}
      onActionChange={handleActionChange}
      pendingActions={pendingActions}
      shortcuts={shortcuts}
      onSwitchStudent={switchingStudent ? undefined : handleSwitchStudent}
      onClose={handleClose}
    >
      {switchingStudent ? (
        <CommandCenterStudentPicker
          currentAlunoId={selectedStudent.id}
          onSelect={handleStudentPicked}
          onCancel={() => setSwitchingStudent(false)}
        />
      ) : !userScope ? (
        // Alternate entrypoints without an authenticated identity must not
        // retain private student panels (conservative security fallback).
        <CommandCenterPanel
          key={`${escolaId}:${selectedStudent.id}:${activeAction}`}
          escolaId={escolaId}
          inModal
          alunoId={activeAction === "enrollment" ? null : selectedStudent.id}
          turmaId={currentStudent?.turmaId ?? null}
          turmaLabel={currentStudent?.turma ?? null}
          actionId={activeAction}
          onActionChange={handleActionChange}
          onSuccess={(newAlunoId) => handleSuccess(activeAction, newAlunoId)}
        />
      ) : (
        <RetainedActionPanels
          key={`${userScope}:${escolaId}:${poloScope}:${selectedStudent.id}`}
          activeAction={activeAction}
          contextSignature={`${userScope}:${escolaId}:${poloScope}:${selectedStudent.id}:${currentStudent?.turmaId ?? "-"}:${academicYearId ?? "-"}:${refreshRevision}`}
          onUnsavedChange={handleUnsavedChange}
            onSubmittingChange={handleSubmittingChange}
            onActionStatusesChange={handleActionDraftStatuses}
          renderAction={(panelAction) => (
            <CommandCenterPanel
              escolaId={escolaId}
              draftScope={`${userScope}:${poloScope}`}
              inModal
              alunoId={panelAction === "enrollment" ? null : selectedStudent.id}
              turmaId={currentStudent?.turmaId ?? null}
              turmaLabel={currentStudent?.turma ?? null}
              actionId={panelAction}
              visible={panelAction === activeAction}
              refreshRevision={refreshRevision}
              onActionChange={handleActionChange}
              onSuccess={(newAlunoId) => handleSuccess(panelAction, newAlunoId)}
            />
          )}
        />
      )}
    </CommandCenterShell>
  );
}

export default BalcaoWorkspace;
