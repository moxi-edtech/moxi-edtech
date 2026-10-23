"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CommandCenterPanel } from "@/components/secretaria/command-center/CommandCenterPanel";
import { CommandCenterShell } from "@/components/secretaria/command-center/CommandCenterShell";
import { CommandCenterStudentPicker } from "@/components/secretaria/command-center/CommandCenterStudentPicker";
import { useCommandCenterStudent } from "@/components/secretaria/command-center/useCommandCenterStudent";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";

type Student = { id: string; label: string };

type Props = {
  open: boolean;
  escolaId: string;
  aluno: Student;
  actionId?: BalcaoActionId;
  onClose: () => void;
  onSuccess?: () => void;
};

function ScopedBalcaoWorkspace({
  open,
  escolaId,
  aluno,
  actionId = "desk",
  onClose,
  onSuccess,
}: Props) {
  // Selecionar "Nova matrícula" muda a operação, nunca o aluno em atendimento.
  const [selectedStudent, setSelectedStudent] = useState<Student>(aluno);
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(actionId);
  const [switchingStudent, setSwitchingStudent] = useState(false);
  // Old asynchronous academic-context responses must never be used after
  // switching school or closing the modal.
  const [yearResult, setYearResult] = useState<{ scope: string; id: string | null }>({
    scope: escolaId, id: null,
  });
  const academicYearId = open && yearResult.scope === escolaId ? yearResult.id : null;
  const { student: studentContext, subtitle } = useCommandCenterStudent(
    selectedStudent.id, academicYearId, selectedStudent.label,
  );
  const currentStudent = studentContext?.id === selectedStudent.id ? studentContext : null;
  const completedEnrollmentRef = useRef(false);
  const studentRequestRef = useRef(0);

  useEffect(() => () => {
    studentRequestRef.current += 1;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!open) return () => controller.abort();
    void fetch("/api/academic-context", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!controller.signal.aborted) setYearResult({
          scope: escolaId,
          id: payload?.ok && typeof payload.context?.anoLetivoId === "string"
            ? payload.context.anoLetivoId : null,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setYearResult({ scope: escolaId, id: null });
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
    setSwitchingStudent(false);
    setActiveAction(next);
  }, [activeAction, confirmLeavingEnrollment]);

  const handleSwitchStudent = useCallback(() => {
    // Opening the picker never discards work or changes the student.
    setSwitchingStudent(true);
  }, []);

  const handleStudentPicked = useCallback((next: Student) => {
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
    setSelectedStudent(next);
    setActiveAction("desk"); // reset all student-bound panels and drafts
    setSwitchingStudent(false);
  }, [selectedStudent.id]);

  const handleClose = useCallback(() => {
    if (!confirmLeavingEnrollment()) return;
    onClose();
  }, [confirmLeavingEnrollment, onClose]);

  const handleSuccess = useCallback((newAlunoId?: string) => {
    if (activeAction === "enrollment" && newAlunoId) {
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
  }, [activeAction, onSuccess]);

  if (!open) return null;

  return (
    <CommandCenterShell
      variant="modal"
      student={{ ...selectedStudent, subtitle: currentStudent ? subtitle : null }}
      activeAction={activeAction}
      onActionChange={handleActionChange}
      onSwitchStudent={switchingStudent ? undefined : handleSwitchStudent}
      onClose={handleClose}
    >
      {switchingStudent ? (
        <CommandCenterStudentPicker
          currentAlunoId={selectedStudent.id}
          onSelect={handleStudentPicked}
          onCancel={() => setSwitchingStudent(false)}
        />
      ) : (
        <CommandCenterPanel
          key={selectedStudent.id}
          escolaId={escolaId}
          inModal
          alunoId={activeAction === "enrollment" ? null : selectedStudent.id}
          turmaId={currentStudent?.turmaId ?? null}
          turmaLabel={currentStudent?.turma ?? null}
          actionId={activeAction}
          onActionChange={handleActionChange}
          onSuccess={handleSuccess}
        />
      )}
    </CommandCenterShell>
  );
}

/** Changing the selected external pupil remounts the entire operation.
 * Drafts within the SAME pupil continue to be preserved in this component.
 * No reset-of-props effect or previously loaded learner data is carried over. */
export function BalcaoWorkspace(props: Props) {
  const key = [props.escolaId, props.aluno.id, props.aluno.label,
    props.actionId ?? "desk"].join(":");
  return <ScopedBalcaoWorkspace key={key} {...props} />;
}

export default BalcaoWorkspace;
